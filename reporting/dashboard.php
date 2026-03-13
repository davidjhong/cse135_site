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
    <link rel="stylesheet" href="css/charts.css">
    <script src="https://d3js.org/d3.v7.min.js"></script>
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
                    <th>User ID</th> <th>Session ID</th>
                    <th>Event Type</th>
                    <th>Created At</th>
                    <th>Raw Payload</th>
                </tr>
            </thead>
            <tbody id="events-tbody">
                <tr><td colspan="5">Loading recent events...</td></tr>
            </tbody>
        </table>
        <div id="table-controls" class="table-controls"></div>
    </div>

    <div class="charts-grid">
        <div class="chart-card">
            <div id="performance-chart"></div> </div>
        <div class="chart-card">
            <div id="activity-chart"></div> </div>
    </div>  

    <script src="js/dashboard.js"></script>
    <script src="js/charts.js"></script>
</body>
</html>