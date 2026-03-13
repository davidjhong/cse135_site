document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('events-tbody');
    const controls = document.getElementById('table-controls');
    
    let allEvents = [];
    const INITIAL_LIMIT = 10;
    let isExpanded = false;

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
            tbody.innerHTML = `<tr><td colspan="6" class="error">Failed to load data: ${error.message}</td></tr>`;
        });

    function renderTable() {
        tbody.innerHTML = ''; 
        
        const limit = isExpanded ? allEvents.length : Math.min(INITIAL_LIMIT, allEvents.length);
        let html = '';

        for (let i = 0; i < limit; i++) {
            const event = allEvents[i];
            
            // 1. Safely parse the raw_data JSON to grab the User ID
            let parsedRaw = {};
            if (event.raw_data) {
                try {
                    parsedRaw = typeof event.raw_data === 'string' ? JSON.parse(event.raw_data) : event.raw_data;
                } catch (e) {
                    console.warn('Failed to parse raw_data for ID:', event.id);
                }
            }

            // 2. Extract values with fallbacks for legacy/broken rows
            const userId = parsedRaw.user_id || event.session_id || 'Legacy/Unknown';
            const sessionId = event.session_id || 'unknown';
            const eventType = event.event_type || 'unknown';
            
            // Format raw data for the alert button
            const rawDataStr = event.raw_data ? JSON.stringify(parsedRaw).replace(/'/g, "\\'").replace(/"/g, '&quot;') : 'No extra data';

            html += `
                <tr>
                    <td>${event.id}</td>
                    <td class="truncate" title="${userId}" style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${userId}</td>
                    <td class="truncate" title="${sessionId}" style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sessionId}</td>
                    <td><span class="badge ${eventType}">${eventType}</span></td>
                    <td>${event.created_at}</td>
                    <td>
                        <button onclick="alert('${rawDataStr}')" style="padding: 4px 8px; font-size: 0.8rem; cursor: pointer;">View</button>
                    </td>
                </tr>
            `;
        }
        
        tbody.innerHTML = html;

        if (allEvents.length > INITIAL_LIMIT) {
            if (isExpanded) {
                controls.innerHTML = `<button id="toggle-btn" style="padding: 10px 20px; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px;">Collapse to ${INITIAL_LIMIT}</button>`;
            } else {
                const hiddenCount = allEvents.length - INITIAL_LIMIT;
                controls.innerHTML = `<button id="toggle-btn" style="padding: 10px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;">View All Remaining (${hiddenCount})</button>`;
            }

            document.getElementById('toggle-btn').addEventListener('click', () => {
                isExpanded = !isExpanded;
                renderTable();
            });
        }
    }
});