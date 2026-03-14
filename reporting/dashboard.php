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
    <noscript>
        <div style="background:#fff3cd;color:#6b4e00;padding:12px 16px;border:1px solid #ffeeba;border-radius:6px;margin:0 0 16px 0;">
            JavaScript is disabled. Live charts and dynamic report features require JavaScript, but authentication and basic navigation still work.
        </div>
    </noscript>
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
        <h3>Recent Analytics Data - Last 30 Days</h3>
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
        <p class="subsection-subtitle">Last 30 Days</p>
        
        <!-- Performance Overview KPI Row -->
        <div class="performance-overview-row">
            <div class="performance-kpi-card">
                <div class="performance-kpi-value" id="performance-kpi-typical">-</div>
                <div class="performance-kpi-label">Typical Load Time</div>
                <div class="performance-kpi-helper" id="performance-kpi-typical-helper">-</div>
            </div>
            <div class="performance-kpi-card">
                <div class="performance-kpi-value" id="performance-kpi-slow">-</div>
                <div class="performance-kpi-label">Slow Load Time</div>
                <div class="performance-kpi-helper" id="performance-kpi-slow-helper">-</div>
            </div>
            <div class="performance-kpi-card">
                <div class="performance-kpi-value" id="performance-kpi-events">-</div>
                <div class="performance-kpi-label">Monitored Page Loads</div>
                <div class="performance-kpi-helper" id="performance-kpi-events-helper">-</div>
            </div>
        </div>
        
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
    </div>
    <?php endif; ?>

    <?php if (canView('performance', $allowedSections)): ?>
    <div class="reliability-charts-box">
        <h3 class="subsection-title">Failure / Reliability Analytics</h3>
        <p class="subsection-subtitle">Track broken assets, failed API requests, 404s, and runtime errors impacting site reliability (Last 30 Days)</p>
        
        <!-- Reliability Overview KPI Row -->
        <div class="reliability-overview-row">
            <div class="reliability-kpi-card">
                <div class="reliability-kpi-value" id="reliability-kpi-total">-</div>
                <div class="reliability-kpi-label">Total Failures</div>
            </div>
            <div class="reliability-kpi-card">
                <div class="reliability-kpi-value" id="reliability-kpi-pages">-</div>
                <div class="reliability-kpi-label">Affected Pages</div>
            </div>
            <div class="reliability-kpi-card">
                <div class="reliability-kpi-value" id="reliability-kpi-avg-session">-</div>
                <div class="reliability-kpi-label">Avg Failures / Session</div>
            </div>
        </div>
        
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
        <p class="subsection-subtitle">Last 30 Days</p>
        
        <!-- Behavior Overview KPI Row -->
        <div class="behavior-overview-row">
            <div class="behavior-kpi-card">
                <div class="behavior-kpi-value" id="behavior-kpi-visits">-</div>
                <div class="behavior-kpi-label">Total Visits</div>
                <div class="behavior-kpi-submetrics" id="behavior-kpi-visits-sub">-</div>
            </div>
            <div class="behavior-kpi-card">
                <div class="behavior-kpi-value" id="behavior-kpi-pages">-</div>
                <div class="behavior-kpi-label">Avg Pages / Visit</div>
                <div class="behavior-kpi-submetrics" id="behavior-kpi-pages-sub">-</div>
            </div>
            <div class="behavior-kpi-card">
                <div class="behavior-kpi-value" id="behavior-kpi-interactions">-</div>
                <div class="behavior-kpi-label">Avg Interactions / Visit</div>
                <div class="behavior-kpi-submetrics" id="behavior-kpi-interactions-sub">-</div>
            </div>
        </div>
        
        <!-- Row 1: Primary behavior charts -->
        <div class="behavior-row-primary">
            <div id="visitor-timeline-chart" class="chart-panel"></div>
            <div id="most-visited-pages-chart" class="chart-panel"></div>
        </div>
        
        <!-- Row 2: Supporting charts -->
        <div class="behavior-row-secondary">
            <div id="pageview-distribution-chart" class="chart-panel"></div>
            <div id="device-category-chart" class="chart-panel"></div>
        </div>
        
        <!-- Row 3: Engagement & Depth Charts -->
        <div class="behavior-row-tertiary">
            <div id="session-depth-chart" class="chart-panel"></div>
            <div id="avg-interactions-chart" class="chart-panel"></div>
        </div>
        
        <!-- Report areas for editors/analysts -->
        <?php if ($userRole !== 'viewer'): ?>
        <div class="behavior-report-row">
            <div class="report-input-area">
                <textarea id="visitor-timeline-comment" placeholder="Add Behavior Timeline Analysis..."></textarea>
                <button onclick="saveReport('behavior', 'Behavioral Insights', 'visitor-timeline-comment')" class="save-btn">Save Behavior Timeline Report</button>
            </div>
        </div>
        <?php endif; ?>
    </div>
    <?php endif; ?>
    
    <div id="saved-reports-container">
        <h3>Saved Analyst Reports</h3>
        <div id="reports-feed">Loading reports...</div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="js/dashboard.js"></script>
    <script src="js/analytics-utils.js"></script>
    <script src="js/charts-performance.js"></script>
    <script src="js/charts-visitors.js"></script>
    <script src="js/charts-reliability.js"></script>
    <script src="js/charts-controller.js"></script>
</body>
</html>