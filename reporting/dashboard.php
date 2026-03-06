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
        <p>Authentication system verified. Ready for data injection.</p>
        </div>

    <script src="js/dashboard.js"></script>
</body>
</html>