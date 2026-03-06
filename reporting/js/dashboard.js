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
            if (allEvents.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">No events found in the database.</td></tr>';
                return;
            }
            renderTable();
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            tbody.innerHTML = `<tr><td colspan="5" class="error">Failed to load data: ${error.message}</td></tr>`;
        });

    function renderTable() {
        tbody.innerHTML = ''; // Clear existing rows
        
        // Determine how many rows to show based on the toggle state
        const limit = isExpanded ? allEvents.length : Math.min(INITIAL_LIMIT, allEvents.length);

        let html = '';
        for (let i = 0; i < limit; i++) {
            const event = allEvents[i];
            const rawDataStr = event.raw_data ? JSON.stringify(event.raw_data).replace(/'/g, "\\'").replace(/"/g, '&quot;') : 'No extra data';

            html += `
                <tr>
                    <td>${event.id}</td>
                    <td class="truncate" title="${event.session_id}">${event.session_id}</td>
                    <td><span class="badge ${event.event_type}">${event.event_type}</span></td>
                    <td>${event.created_at}</td>
                    <td>
                        <button onclick="alert('${rawDataStr}')" style="padding: 4px 8px; font-size: 0.8rem; cursor: pointer;">View</button>
                    </td>
                </tr>
            `;
        }
        
        tbody.innerHTML = html;

        // Render the toggle button if we have more than 25 total events
        if (allEvents.length > INITIAL_LIMIT) {
            if (isExpanded) {
                controls.innerHTML = `<button id="toggle-btn" style="padding: 10px 20px; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px;">Collapse to ${INITIAL_LIMIT}</button>`;
            } else {
                const hiddenCount = allEvents.length - INITIAL_LIMIT;
                controls.innerHTML = `<button id="toggle-btn" style="padding: 10px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;">View All Remaining (${hiddenCount})</button>`;
            }

            // Attach the event listener to flip the state and re-render
            document.getElementById('toggle-btn').addEventListener('click', () => {
                isExpanded = !isExpanded;
                renderTable();
            });
        }
    }
});