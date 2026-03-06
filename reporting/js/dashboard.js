document.addEventListener('DOMContentLoaded', () => {
    const dataContainer = document.getElementById('data-container');
    dataContainer.innerHTML = '<h3>Loading recent events...</h3>';

    let allEvents = [];
    let currentlyDisplayed = 0;
    const INITIAL_LIMIT = 25;

    fetch('/api/events')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            allEvents = data;
            if (allEvents.length === 0) {
                dataContainer.innerHTML = '<p>No events found in the database.</p>';
                return;
            }

            // Scaffold the table and a container for the Load More button
            dataContainer.innerHTML = `
                <h3>Recent Analytics Data</h3>
                <table class="data-table" id="events-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Session ID</th>
                            <th>Event Type</th>
                            <th>Created At</th>
                            <th>Raw Payload</th>
                        </tr>
                    </thead>
                    <tbody id="events-tbody"></tbody>
                </table>
                <div id="button-container" style="text-align: center; margin-top: 20px;"></div>
            `;

            renderRows(INITIAL_LIMIT);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            dataContainer.innerHTML = `<p class="error">Failed to load data: ${error.message}</p>`;
        });

    // Function to inject a specific number of rows into the DOM
    function renderRows(limit) {
        const tbody = document.getElementById('events-tbody');
        const buttonContainer = document.getElementById('button-container');
        
        const endIdx = Math.min(currentlyDisplayed + limit, allEvents.length);
        let html = '';

        for (let i = currentlyDisplayed; i < endIdx; i++) {
            const event = allEvents[i];
            
            // Safely format the raw JSON so it doesn't break the HTML attributes
            const rawDataStr = event.raw_data ? JSON.stringify(event.raw_data).replace(/"/g, '&quot;') : 'No extra data';

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

        tbody.innerHTML += html;
        currentlyDisplayed = endIdx;

        // If there is still data hidden, show the "View All" button
        if (currentlyDisplayed < allEvents.length) {
            const remainingCount = allEvents.length - currentlyDisplayed;
            buttonContainer.innerHTML = `
                <button id="load-more-btn" style="padding: 10px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;">
                    View All Remaining (${remainingCount})
                </button>
            `;
            
            document.getElementById('load-more-btn').addEventListener('click', () => {
                renderRows(allEvents.length - currentlyDisplayed);
            });
        } else {
            buttonContainer.innerHTML = ''; 
        }
    }
});