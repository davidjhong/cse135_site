<?php
session_start();

if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header("Location: login.php");
    exit();
}

// Extract RBAC variables with safe fallbacks
$userRole = $_SESSION['role'] ?? 'viewer';
$allowedSections = $_SESSION['allowed_sections'] ?? [];

// Helper function to check if a user has access to a specific section
function canView($section, $allowedSections) {
    return in_array('all', $allowedSections) || in_array($section, $allowedSections);
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
    
    <script>
        const currentUserRole = "<?php echo htmlspecialchars($userRole); ?>";
    </script>
</head>
<body>
    <div class="nav">
        <h2>Analytics Dashboard</h2>
        <div>
            Welcome, <?php echo htmlspecialchars($_SESSION['username']); ?> 
            (Role: <?php echo htmlspecialchars(ucwords(str_replace('_', ' ', $userRole))); ?>) | 
            <a href="logout.php" class="logout">Logout</a>
        </div>
    </div>

    <?php if (canView('raw_data', $allowedSections)): ?>
    <div id="data-container">
        <h3>Recent Analytics Data</h3>
        <table class="data-table" id="events-table">
            <thead>
                <tr id="table-header-row">
                    <th>ID</th>
                    <th>User ID</th> 
                    <th>Session ID</th>
                    <th>Event Type</th>
                    <th>Created At</th>
                    <th>Raw Payload</th>
                    </tr>
            </thead>
            <tbody id="events-tbody">
                <tr><td colspan="6">Loading recent events...</td></tr>
            </tbody>
        </table>
        <div id="table-controls" class="table-controls">
            <button id="toggle-btn" class="table-toggle-btn" type="button" hidden></button>
        </div>
    </div>
    <?php endif; ?>

    <div class="charts-grid">
        <?php if (canView('performance', $allowedSections)): ?>
        <div class="chart-card">
            <div id="performance-chart"></div> 

            <?php if ($userRole !== 'viewer'): ?>
            <div class="report-input-area">
                <textarea id="performance-comment" placeholder="Add Performance Analysis..."></textarea>
                <button onclick="saveReport('performance', 'Traffic Overview Timeline')" class="save-btn">Save Report</button>
            </div>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <?php if (canView('behavior', $allowedSections)): ?>
        <div class="chart-card">
            <div id="activity-chart"></div>

            <?php if ($userRole !== 'viewer'): ?>
            <div class="report-input-area">
                <textarea id="behavior-comment" placeholder="Add Behavior Analysis..."></textarea>
                <button onclick="saveReport('behavior', 'Device Category Pie Chart')" class="save-btn">Save Report</button>
            </div>
            <?php endif; ?>
        </div>
        <?php endif; ?> 
    </div>  
    
    <?php if ($userRole === 'viewer' || $userRole === 'super_admin'): ?>
    <div id="saved-reports-container">
        <h3>Saved Analyst Reports</h3>
        <div id="reports-feed">Loading reports...</div>
    </div>
    <?php endif; ?>

    <script src="js/dashboard.js"></script>
    <script src="js/charts.js"></script>
</body>
</html>