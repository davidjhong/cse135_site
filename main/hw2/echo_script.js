// Show the "JS Active" status since this script is running
document.getElementById('js-status').style.display = 'inline';

document.getElementById('echoForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // 1. Gather Data
    const endpoint = document.getElementById('endpoint').value;
    const method = document.getElementById('method').value;
    const encoding = document.getElementById('encoding').value;
    const messageVal = document.getElementById('message').value;
    const extraVal = document.getElementById('extra').value;

    let body = null;
    let headers = {};

    // 2. Prepare Body (for POST/PUT/DELETE)
    if (method !== 'GET') {
        if (encoding === 'application/json') {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({ message: messageVal, extra: extraVal });
        } else {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            const params = new URLSearchParams();
            params.append('message', messageVal);
            params.append('extra', extraVal);
            body = params.toString();
        }
    }

    // 3. Prepare URL (for GET query strings)
    let fetchUrl = endpoint;
    if (method === 'GET') {
        const params = new URLSearchParams();
        params.append('message', messageVal);
        params.append('extra', extraVal);
        fetchUrl += '?' + params.toString();
    }

    // 4. Send Request
    fetch(fetchUrl, {
        method: method,
        headers: headers,
        body: body
    })
    .then(response => response.text())
    .then(html => {
        // 5. Display Result
        // Write the HTML response from the server directly to the document
        document.open();
        document.write(html);
        document.close();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Request failed. See console.');
    });
});