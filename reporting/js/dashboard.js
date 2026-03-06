document.addEventListener('DOMContentLoaded', () => {
    const dataContainer = document.getElementById('data-container');
    
    // Clear the placeholder text
    dataContainer.innerHTML = '<h3>Loading recent events...</h3>';

    fetch('/api/events')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.length === 0) {
                dataContainer.innerHTML = '<p>No events found in the database.</p>';
                return;
            }

            // Build the HTML Table
            let tableHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Session ID</th>
                            <th>Event Type</th>
                            <th>Created At</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Loop through the JSON payload and generate rows
            data.forEach(event => {
                tableHTML += `
                    <tr>
                        <td>${event.id}</td>
                        <td class="truncate" title="${event.session_id}">${event.session_id}</td>
                        <td><span class="badge ${event.event_type}">${event.event_type}</span></td>
                        <td>${event.created_at}</td>
                    </tr>
                `;
            });

            tableHTML += `
                    </tbody>
                </table>
            `;

            dataContainer.innerHTML = `<h3>Recent Analytics Data</h3>` + tableHTML;
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            dataContainer.innerHTML = `<p class="error">Failed to load data: ${error.message}</p>`;
        });
});