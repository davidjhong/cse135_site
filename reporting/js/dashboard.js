document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('events-tbody');
    const controls = document.getElementById('table-controls');
    const toggleButton = document.getElementById('toggle-btn');
    
    let allEvents = [];
    const INITIAL_LIMIT = 10;
    const MAX_DISPLAY_EVENTS = 100;
    let isExpanded = false;

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

    fetch('/api/events')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            allEvents = data;

            // Broadcast data to charts.js
            const dataEvent = new CustomEvent('analyticsDataLoaded', { detail: allEvents });
            document.dispatchEvent(dataEvent);

            if (allEvents.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No events found in the database.</td></tr>';
                return;
            }
            renderTable();
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.className = 'error';
            cell.textContent = `Failed to load data: ${error.message}`;
            row.appendChild(cell);
            tbody.replaceChildren(row);

            if (toggleButton) {
                toggleButton.hidden = true;
            }
        });

    function renderTable() {
        tbody.replaceChildren();
        
        const displayEvents = allEvents.slice(0, MAX_DISPLAY_EVENTS);
        const limit = isExpanded ? displayEvents.length : Math.min(INITIAL_LIMIT, displayEvents.length);
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < limit; i++) {
            const event = displayEvents[i];
            
            let parsedRaw = {};
            if (event.raw_data) {
                try {
                    parsedRaw = typeof event.raw_data === 'string' ? JSON.parse(event.raw_data) : event.raw_data;
                } catch (e) {
                    console.warn('Failed to parse raw_data for ID:', event.id);
                }
            }

            const userId = parsedRaw.user_id || event.session_id || 'Legacy/Unknown';
            const sessionId = event.session_id || 'unknown';
            const eventType = event.event_type || 'unknown';

            const rawDataText = event.raw_data ? JSON.stringify(parsedRaw, null, 2) : 'No extra data';

            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = String(event.id ?? '');

            const userCell = document.createElement('td');
            userCell.className = 'truncate';
            userCell.title = String(userId);
            userCell.textContent = String(userId);

            const sessionCell = document.createElement('td');
            sessionCell.className = 'truncate';
            sessionCell.title = String(sessionId);
            sessionCell.textContent = String(sessionId);

            const eventTypeCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = `badge ${eventType}`;
            badge.textContent = eventType;
            eventTypeCell.appendChild(badge);

            const createdAtCell = document.createElement('td');
            createdAtCell.textContent = String(event.created_at ?? '');

            const payloadCell = document.createElement('td');
            const viewButton = document.createElement('button');
            viewButton.type = 'button';
            viewButton.className = 'view-raw-btn';
            viewButton.textContent = 'View';
            viewButton.dataset.rawPayload = rawDataText;
            payloadCell.appendChild(viewButton);

            row.append(idCell, userCell, sessionCell, eventTypeCell, createdAtCell, payloadCell);
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
});