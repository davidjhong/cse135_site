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

    <?php if (canView('performance', $allowedSections)): ?>
    <div class="perf-charts-box">
        <h3 class="subsection-title">Load Time Analytics</h3>
        <div class="perf-row-top">
            <div id="perf-trend-chart" class="chart-panel"></div>
            <div id="perf-bar-chart" class="chart-panel"></div>
        </div>
        <div class="perf-row-bottom">
            <div id="perf-box-plot" class="chart-panel"></div>
            <?php if ($userRole !== 'viewer'): ?>
            <div class="report-input-area">
                <textarea id="loadtime-comment" placeholder="Add Load Time Analysis..."></textarea>
                <button onclick="saveReport('performance', 'Load Time Charts', 'loadtime-comment')" class="save-btn">Save Load Time Report</button>
            </div>
            <?php endif; ?>
        </div>
        
        <h3 class="subsection-title">Failure / Reliability Analytics</h3>
        <p class="subsection-subtitle">Track broken assets, failed API requests, 404s, and runtime errors impacting site reliability</p>
        <div class="reliability-charts-grid">
            <div class="reliability-row-top">
                <div id="reliability-type-chart" class="chart-panel reliability-chart"></div>
                <div id="reliability-page-chart" class="chart-panel reliability-chart"></div>
            </div>
            
            <div class="reliability-row-bottom">
                <div id="reliability-urls-chart" class="chart-panel reliability-chart"></div>
                <?php if ($userRole !== 'viewer'): ?>
                <div class="report-input-area">
                    <textarea id="reliability-comment" placeholder="Add Failure / Reliability Analysis..."></textarea>
                    <button onclick="saveReport('performance', 'Failure Analysis', 'reliability-comment')" class="save-btn">Save Reliability Report</button>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <?php if (canView('behavior', $allowedSections)): ?>
    <div class="behavior-charts-box">
        <h3 class="subsection-title">Visitor Behavior Analytics</h3>
        
        <!-- Row 1: Primary behavior charts -->
        <div class="behavior-row-primary">
            <div id="visitor-timeline-chart" class="chart-panel"></div>
            <div id="most-visited-pages-chart" class="chart-panel"></div>
        </div>
        
        <!-- Row 2: Supporting chart -->
        <div class="behavior-row-secondary">
            <div id="device-category-chart" class="chart-panel"></div>
        </div>
        
        <!-- Report areas for editors/analysts -->
        <?php if ($userRole !== 'viewer'): ?>
        <div class="behavior-report-row">
            <div class="report-input-area">
                <textarea id="visitor-timeline-comment" placeholder="Add Visitor Timeline Analysis..."></textarea>
                <button onclick="saveReport('behavior', 'Visitor Timeline Chart', 'visitor-timeline-comment')" class="save-btn">Save Visitor Timeline Report</button>
            </div>
            <div class="report-input-area">
                <textarea id="device-category-comment" placeholder="Add Device Category Analysis..."></textarea>
                <button onclick="saveReport('behavior', 'Device Category Pie Chart', 'device-category-comment')" class="save-btn">Save Device Category Report</button>
            </div>
        </div>
        <?php endif; ?>
    </div>
    <?php endif; ?>
    
    <?php if ($userRole === 'viewer' || $userRole === 'super_admin'): ?>
    <div id="saved-reports-container">
        <h3>Saved Analyst Reports</h3>
        <div id="reports-feed">Loading reports...</div>
    </div>
    <?php endif; ?>

    <script src="js/dashboard.js"></script>
    <script src="js/charts-performance.js"></script>
    <script src="js/charts-behavior.js"></script>
    <script src="js/charts-visitors.js"></script>
    <script src="js/charts-reliability.js"></script>
    <script src="js/charts-controller.js"></script>
</body>
</html>