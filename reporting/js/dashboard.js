document.addEventListener('DOMContentLoaded', () => {
    const EVENTS_API_URL = 'https://reporting.davidjhong.site/api/events.php';

    fetch(EVENTS_API_URL)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            // Broadcast data to charts.js immediately
            const dataEvent = new CustomEvent('analyticsDataLoaded', { detail: data });
            document.dispatchEvent(dataEvent);

            // 2. DOM RENDERING (Conditional)
            // Only attempt to build the table if PHP rendered the container
            const tbody = document.getElementById('events-tbody');
            if (tbody) {
                initTable(data, tbody);
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            const tbody = document.getElementById('events-tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="error">Failed to load data: ${error.message}</td></tr>`;
            }
        });

    // 3. TABLE LOGIC ENCAPSULATION
    // All variables and listeners for the table live safely inside this function
    function initTable(allEvents, tbody) {
        const controls = document.getElementById('table-controls');
        const toggleButton = document.getElementById('toggle-btn');
        const quickCollapseButton = document.createElement('button');
        quickCollapseButton.type = 'button';
        quickCollapseButton.className = 'table-quick-collapse-btn';
        quickCollapseButton.textContent = 'Collapse Table';
        quickCollapseButton.hidden = true;
        document.body.appendChild(quickCollapseButton);

        const getDateKey = (rawValue) => {
            if (!rawValue) return null;
            const value = String(rawValue).trim();
            const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
            return match ? match[1] : null;
        };

        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
        const startKey = startDate.toISOString().slice(0, 10);
        const endKey = today.toISOString().slice(0, 10);
        const eventsLast30Days = allEvents.filter((event) => {
            const dateKey = getDateKey(event.created_at);
            return Boolean(dateKey) && dateKey >= startKey && dateKey <= endKey;
        });
        
        const INITIAL_LIMIT = 10;
        let isExpanded = false;

        if (eventsLast30Days.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No events found in the last 30 days.</td></tr>';
            quickCollapseButton.hidden = true;
            return;
        }

        // Attach listeners safely
        tbody.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.classList.contains('view-raw-btn')) return;

            const payload = target.dataset.rawPayload || 'No extra data';
            alert(payload);
        });

        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                isExpanded = !isExpanded;
                renderTable();
            });
        }

        quickCollapseButton.addEventListener('click', () => {
            isExpanded = false;
            renderTable();
            const container = document.getElementById('data-container');
            if (container) {
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        function renderTable() {
            tbody.replaceChildren();
            
            const headerRow = document.getElementById('table-header-row');
            if (typeof currentUserRole !== 'undefined' && currentUserRole === 'super_admin' && headerRow && !document.getElementById('header-actions')) {
                const th = document.createElement('th');
                th.id = 'header-actions';
                th.textContent = 'Actions';
                headerRow.appendChild(th);
            }

            const displayEvents = eventsLast30Days;
            const limit = isExpanded ? displayEvents.length : Math.min(INITIAL_LIMIT, displayEvents.length);
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < limit; i++) {
                const event = displayEvents[i];
                
                let parsedRaw = {};
                if (event.raw_data) {
                    try { parsedRaw = typeof event.raw_data === 'string' ? JSON.parse(event.raw_data) : event.raw_data; } 
                    catch (e) { console.warn('Failed to parse raw_data for ID:', event.id); }
                }

                const userId = parsedRaw.user_id || event.session_id || 'Legacy/Unknown';
                const sessionId = event.session_id || 'unknown';
                const eventType = event.event_type || 'unknown';
                const rawDataText = event.raw_data ? JSON.stringify(parsedRaw, null, 2) : 'No extra data';

                const row = document.createElement('tr');

                const idCell = document.createElement('td'); idCell.textContent = String(event.id ?? '');
                const userCell = document.createElement('td'); userCell.className = 'truncate'; userCell.title = String(userId); userCell.textContent = String(userId);
                const sessionCell = document.createElement('td'); sessionCell.className = 'truncate'; sessionCell.title = String(sessionId); sessionCell.textContent = String(sessionId);
                
                const eventTypeCell = document.createElement('td');
                const badge = document.createElement('span'); badge.className = `badge ${eventType}`; badge.textContent = eventType;
                eventTypeCell.appendChild(badge);

                const createdAtCell = document.createElement('td'); createdAtCell.textContent = String(event.created_at ?? '');

                const payloadCell = document.createElement('td');
                const viewButton = document.createElement('button'); viewButton.type = 'button'; viewButton.className = 'view-raw-btn'; viewButton.textContent = 'View'; viewButton.dataset.rawPayload = rawDataText;
                payloadCell.appendChild(viewButton);

                row.append(idCell, userCell, sessionCell, eventTypeCell, createdAtCell, payloadCell);

                if (typeof currentUserRole !== 'undefined' && currentUserRole === 'super_admin') {
                    const actionCell = document.createElement('td');
                    const deleteButton = document.createElement('button');
                    deleteButton.type = 'button'; deleteButton.className = 'delete-btn'; deleteButton.textContent = 'Delete';
                    deleteButton.onclick = () => deleteEvent(event.id);
                    actionCell.appendChild(deleteButton);
                    row.appendChild(actionCell);
                }

                fragment.appendChild(row);
            }
            
            tbody.appendChild(fragment);

            if (!toggleButton) return;
            if (displayEvents.length > INITIAL_LIMIT) {
                if (isExpanded) {
                    toggleButton.textContent = `Collapse to ${INITIAL_LIMIT}`;
                    toggleButton.classList.remove('expand');
                    toggleButton.classList.add('collapse');
                    quickCollapseButton.hidden = false;
                } else {
                    const hiddenCount = displayEvents.length - INITIAL_LIMIT;
                    toggleButton.textContent = `View Remaining (${hiddenCount})`;
                    toggleButton.classList.remove('collapse');
                    toggleButton.classList.add('expand');
                    quickCollapseButton.hidden = true;
                }
                toggleButton.hidden = false;
                controls.hidden = false;
            } else {
                toggleButton.hidden = true;
                controls.hidden = true;
                quickCollapseButton.hidden = true;
            }
        }

        renderTable(); // Initial draw
    }
});

// Attached to the global window object so inline HTML onclick="" can reach it
window.deleteEvent = function(id) {
    if (!confirm(`Are you sure you want to permanently delete Event ID ${id}?`)) return;

    fetch(`/api/events/${id}`, { method: 'DELETE' })
        .then(response => {
            if (!response.ok) throw new Error('Failed to delete or unauthorized.');
            return response.json();
        })
        .then(data => {
            alert(data.message);
            location.reload();
        })
        .catch(error => alert(error.message));
};

window.saveReport = function(category, chartName, inputId) {
    const resolveCaptureSelector = () => {
        if (inputId === 'reliability-comment' || chartName === 'Failure Analysis') {
            return '.reliability-charts-box';
        }
        if (category === 'behavior') {
            return '.behavior-charts-box';
        }
        if (category === 'performance') {
            return '.perf-charts-box';
        }
        return null;
    };

    const performSave = async () => {
        const textArea = document.getElementById(inputId || `${category}-comment`);
        if (!textArea) {
            alert('Report input not found.');
            return;
        }

        const text = textArea.value.trim();
        if (!text) {
            alert('Please enter some analysis before saving.');
            return;
        }

        if (typeof html2canvas !== 'function') {
            alert('Snapshot library failed to load. Please refresh and try again.');
            return;
        }

        const selector = resolveCaptureSelector();
        const captureContainer = selector ? document.querySelector(selector) : null;
        if (!captureContainer) {
            alert('Chart container not found for snapshot.');
            return;
        }

        const reportAreas = Array.from(captureContainer.querySelectorAll('.report-input-area'));
        const previousDisplays = reportAreas.map(area => area.style.display);

        let snapshotBase64 = null;

        try {
            reportAreas.forEach(area => {
                area.style.display = 'none';
            });

            const canvas = await html2canvas(captureContainer, {
                backgroundColor: '#ffffff',
                useCORS: true,
                scale: 2
            });
            snapshotBase64 = canvas.toDataURL('image/jpeg', 0.95);
        } catch (error) {
            console.error('Failed to capture snapshot:', error);
            alert('Failed to capture chart snapshot. Please try again.');
            return;
        } finally {
            reportAreas.forEach((area, index) => {
                area.style.display = previousDisplays[index];
            });
        }

        try {
            const response = await fetch('api/reports.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    chart_name: chartName,
                    comment_text: text,
                    chart_snapshot: snapshotBase64
                })
            });

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const bodyText = await response.text();
                throw new Error(`Invalid JSON from reports API: ${bodyText.slice(0, 180)}`);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error((data && data.error) ? data.error : `Reports API failed (${response.status}).`);
            }

            if (data && data.error) {
                throw new Error(data.error);
            }

            alert(data.message);
            textArea.value = '';
            if (typeof loadReports === 'function') loadReports();
        } catch (error) {
            alert(error.message);
        }
    };

    performSave();
};

window.buildReportPdfDocument = async function(report) {
    if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
        throw new Error('PDF library failed to load. Please refresh and try again.');
    }

    const loadImageDimensions = (dataUrl) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Failed to decode snapshot image.'));
        image.src = dataUrl;
    });

    const hasSnapshot = report.chart_snapshot && typeof report.chart_snapshot === 'string' && report.chart_snapshot.startsWith('data:image');

    let snapshotDimensions = null;
    if (hasSnapshot) {
        try {
            snapshotDimensions = await loadImageDimensions(report.chart_snapshot);
        } catch (error) {
            console.error('Failed to read snapshot dimensions:', error);
        }
    }

    const orientation = snapshotDimensions && snapshotDimensions.width > snapshotDimensions.height ? 'landscape' : 'portrait';
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation });
    const margin = 24;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);

    if (snapshotDimensions) {
        try {
            pdf.setFontSize(13);
            pdf.text(`Analytics Report #${report.id}`, margin, margin + 10);

            const availableHeight = pageHeight - ((margin * 2) + 24);
            const widthScale = contentWidth / snapshotDimensions.width;
            const heightScale = availableHeight / snapshotDimensions.height;
            const scale = Math.min(widthScale, heightScale);

            const renderWidth = snapshotDimensions.width * scale;
            const renderHeight = snapshotDimensions.height * scale;
            const renderX = (pageWidth - renderWidth) / 2;
            const renderY = margin + 20 + ((availableHeight - renderHeight) / 2);

            pdf.addImage(report.chart_snapshot, 'JPEG', renderX, renderY, renderWidth, renderHeight, undefined, 'SLOW');
            pdf.addPage('p', 'a4');
        } catch (error) {
            console.error('Failed to add snapshot image to PDF:', error);
        }
    }

    const textPageWidth = pdf.internal.pageSize.getWidth();
    const textMargin = 40;
    const textContentWidth = textPageWidth - (textMargin * 2);

    pdf.setFontSize(14);
    pdf.text(`Analytics Report #${report.id}`, textMargin, 50);
    pdf.setFontSize(11);
    pdf.text(`Category: ${report.category || 'Unknown'}`, textMargin, 72);
    pdf.text(`Chart: ${report.chart_name || 'Unknown Chart'}`, textMargin, 88);
    pdf.text(`Author: ${report.username || 'Unknown'}`, textMargin, 104);
    pdf.text(`Created: ${report.created_at || ''}`, textMargin, 120);

    const comment = report.comment_text || '';
    const wrappedComment = pdf.splitTextToSize(comment, textContentWidth);
    pdf.setFontSize(12);
    pdf.text('Analyst Comment:', textMargin, 150);
    pdf.setFontSize(11);
    pdf.text(wrappedComment, textMargin, 168);

    return pdf;
};

window.exportReportToPdf = async function(report) {
    try {
        const pdf = await window.buildReportPdfDocument(report);
        pdf.save(`analytics-report-${report.id}.pdf`);
    } catch (error) {
        alert(error.message);
    }
};

window.emailReportToUser = async function(report) {
    const targetEmail = prompt('Enter recipient email address:');
    if (!targetEmail) return;

    const email = targetEmail.trim();
    if (!email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }

    try {
        const pdf = await window.buildReportPdfDocument(report);
        const pdfDataUri = pdf.output('datauristring');

        const response = await fetch('email-report.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                report_id: report.id,
                pdf_base64: pdfDataUri
            })
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const bodyText = await response.text();
            throw new Error(`Invalid JSON from email endpoint: ${bodyText.slice(0, 180)}`);
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error((data && data.error) ? data.error : `Email endpoint failed (${response.status}).`);
        }

        if (data && data.error) {
            throw new Error(data.error);
        }

        alert(data.message || 'Report email sent successfully.');
    } catch (error) {
        alert(error.message);
    }
};

window.deleteReport = function(reportId) {
    if (typeof currentUserRole === 'undefined' || currentUserRole !== 'super_admin') {
        alert('Only Super Admins can delete reports.');
        return;
    }

    if (!confirm(`Delete report #${reportId}? This action cannot be undone.`)) {
        return;
    }

    fetch(`api/reports.php?id=${encodeURIComponent(reportId)}`, { method: 'DELETE' })
        .then(async (res) => {
            const bodyText = await res.text();
            const contentType = res.headers.get('content-type') || '';

            if (!contentType.includes('application/json')) {
                throw new Error(`Invalid JSON from reports API: ${bodyText.slice(0, 180)}`);
            }

            let data;
            try {
                data = JSON.parse(bodyText);
            } catch {
                throw new Error(`Invalid JSON from reports API: ${bodyText.slice(0, 180)}`);
            }

            if (!res.ok) {
                throw new Error((data && data.error) ? data.error : `Failed to delete report (${res.status}).`);
            }

            return data;
        })
        .then((data) => {
            alert(data.message || 'Report deleted successfully.');
            if (typeof loadReports === 'function') loadReports();
        })
        .catch((error) => {
            alert(error.message);
        });
};

window.loadReports = function() {
    const feed = document.getElementById('reports-feed');
    if (!feed) return;

    fetch('api/reports.php')
        .then(async (res) => {
            const bodyText = await res.text();
            const contentType = res.headers.get('content-type') || '';

            if (!contentType.includes('application/json')) {
                throw new Error(`Invalid JSON from reports API: ${bodyText.slice(0, 180)}`);
            }

            let data;
            try {
                data = JSON.parse(bodyText);
            } catch {
                throw new Error(`Invalid JSON from reports API: ${bodyText.slice(0, 180)}`);
            }

            if (!res.ok) {
                throw new Error((data && data.error) ? data.error : `Reports API failed (${res.status}).`);
            }

            if (!Array.isArray(data)) {
                throw new Error('Unexpected reports payload shape from reports API.');
            }

            return data;
        })
        .then(data => {
            feed.replaceChildren();

            if (data.length === 0) {
                const empty = document.createElement('p');
                empty.textContent = 'No reports have been saved yet.';
                feed.appendChild(empty);
                return;
            }

            const fragment = document.createDocumentFragment();
            data.forEach(report => {
                const categoryName = report.category || 'Unknown';
                const chartName = report.chart_name || 'Unknown Chart';

                const card = document.createElement('div');
                card.className = 'report-card';

                const title = document.createElement('h4');
                title.className = 'report-card-title';
                title.textContent = `${categoryName} Report - ${chartName}`;

                const body = document.createElement('p');
                body.className = 'report-card-body';
                body.textContent = report.comment_text || '';

                const commentLabel = document.createElement('div');
                commentLabel.className = 'report-card-comment-label';
                commentLabel.textContent = 'Comments';

                const cardNodes = [title];

                if (report.chart_snapshot && typeof report.chart_snapshot === 'string') {
                    const snapshot = document.createElement('img');
                    snapshot.src = report.chart_snapshot;
                    snapshot.alt = `Snapshot for report ${report.id}`;
                    snapshot.className = 'report-card-snapshot';
                    snapshot.loading = 'lazy';
                    cardNodes.push(snapshot);
                }

                const meta = document.createElement('small');
                meta.className = 'report-card-meta';
                meta.append('Authored by ');

                const username = document.createElement('strong');
                username.textContent = report.username || 'Unknown';
                meta.append(username, ` on ${report.created_at || ''}`);

                const exportBtn = document.createElement('button');
                exportBtn.type = 'button';
                exportBtn.className = 'save-btn report-action-btn';
                exportBtn.textContent = 'Export to PDF';
                exportBtn.addEventListener('click', () => window.exportReportToPdf(report));

                const emailBtn = document.createElement('button');
                emailBtn.type = 'button';
                emailBtn.className = 'save-btn report-action-btn';
                emailBtn.textContent = 'Email Report';
                emailBtn.addEventListener('click', () => window.emailReportToUser(report));

                const actions = document.createElement('div');
                actions.className = 'report-card-actions';
                actions.appendChild(exportBtn);
                actions.appendChild(emailBtn);

                cardNodes.push(commentLabel, body, meta);

                if (typeof currentUserRole !== 'undefined' && currentUserRole === 'super_admin') {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.className = 'save-btn report-action-btn';
                    deleteBtn.textContent = 'Delete Report';
                    deleteBtn.addEventListener('click', () => window.deleteReport(report.id));
                    actions.appendChild(deleteBtn);
                }

                cardNodes.push(actions);

                card.append(...cardNodes);
                fragment.appendChild(card);
            });
            feed.appendChild(fragment);
        })
        .catch((error) => {
            console.error('Failed to load reports:', error);
            feed.replaceChildren();
            const errMsg = document.createElement('p');
            errMsg.className = 'error';
            errMsg.textContent = `Failed to load reports: ${error.message}`;
            feed.appendChild(errMsg);
        });
};

// Auto-load reports if the container exists
if (document.getElementById('reports-feed')) {
    loadReports();
}