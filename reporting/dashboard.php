<?php
session_start();

if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header("Location: login.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Analytics Dashboard</title>
    <link rel="stylesheet" href="css/dashboard.css">
    </head>
<body>
    <div class="nav">
        <h2>Analytics Dashboard</h2>
        <div>
            Welcome, <?php echo htmlspecialchars($_SESSION['username']); ?> | 
            <a href="logout.php" class="logout">Logout</a>
        </div>
    </div>

    <div id="data-container">
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
            <tbody id="events-tbody">
                <tr><td colspan="5">Loading recent events...</td></tr>
            </tbody>
        </table>
        <div id="table-controls" style="text-align: center; margin-top: 20px;"></div>
    </div>

    <script src="js/dashboard.js"></script>
</body>
</html>