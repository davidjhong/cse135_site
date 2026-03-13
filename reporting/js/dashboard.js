document.addEventListener('DOMContentLoaded', () => {
    // 1. DATA FETCHING (Unconditional)
    // We fetch the data immediately so charts get what they need, regardless of table permissions.
    fetch('/api/events')
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
        
        const INITIAL_LIMIT = 10;
        const MAX_DISPLAY_EVENTS = 100;
        let isExpanded = false;

        if (allEvents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No events found in the database.</td></tr>';
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

        function renderTable() {
            tbody.replaceChildren();
            
            const headerRow = document.getElementById('table-header-row');
            if (typeof currentUserRole !== 'undefined' && currentUserRole === 'super_admin' && headerRow && !document.getElementById('header-actions')) {
                const th = document.createElement('th');
                th.id = 'header-actions';
                th.textContent = 'Actions';
                headerRow.appendChild(th);
            }

            const displayEvents = allEvents.slice(0, MAX_DISPLAY_EVENTS);
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
                } else {
                    const hiddenCount = displayEvents.length - INITIAL_LIMIT;
                    toggleButton.textContent = `View Remaining (${hiddenCount})`;
                    toggleButton.classList.remove('collapse');
                    toggleButton.classList.add('expand');
                }
                toggleButton.hidden = false;
                controls.hidden = false;
            } else {
                toggleButton.hidden = true;
                controls.hidden = true;
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

window.saveReport = function(category) {
    const textArea = document.getElementById(`${category}-comment`);
    const text = textArea.value.trim();

    if (!text) {
        alert("Please enter some analysis before saving.");
        return;
    }

    fetch('/api/reports.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            category: category,
            chart_name: chartName,
            comment_text: text
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to save report');
        return response.json();
    })
    .then(data => {
        alert(data.message);
        textArea.value = ''; // Clear the box on success
        if (typeof loadReports === 'function') loadReports(); // Refresh feed if visible
    })
    .catch(error => alert(error.message));
};

window.loadReports = function() {
    const feed = document.getElementById('reports-feed');
    if (!feed) return;

    fetch('/api/reports.php')
        .then(res => res.json())
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

                const meta = document.createElement('small');
                meta.className = 'report-card-meta';
                meta.append('Authored by ');

                const username = document.createElement('strong');
                username.textContent = report.username || 'Unknown';
                meta.append(username, ` on ${report.created_at || ''}`);

                card.append(title, body, meta);
                fragment.appendChild(card);
            });
            feed.appendChild(fragment);
        })
        .catch(() => {
            feed.replaceChildren();
            const errMsg = document.createElement('p');
            errMsg.className = 'error';
            errMsg.textContent = 'Failed to load reports.';
            feed.appendChild(errMsg);
        });
};

// Auto-load reports if the container exists
if (document.getElementById('reports-feed')) {
    loadReports();
}