<?php
session_start();
header("Content-Type: application/json; charset=UTF-8");

$host = 'localhost';
$db   = 'analytics_db';
$user = 'analytics_user';
$pass = 'SuperSecurePass123!';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (\PDOException $e) {
    exit(json_encode(["error" => "Database connection failed"]));
}

$method = $_SERVER['REQUEST_METHOD'];

// Ensure user is logged in
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    http_response_code(401);
    exit(json_encode(["error" => "Unauthorized"]));
}

switch ($method) {
    case 'POST':
        // Only analysts and super_admin can save reports
        if ($_SESSION['role'] === 'viewer') {
            http_response_code(403);
            exit(json_encode(["error" => "Viewers cannot create reports"]));
        }

        $input = json_decode(file_get_contents("php://input"), true);
        if (!isset($input['category']) || !isset($input['chart_name']) || !isset($input['comment_text'])) {
            http_response_code(400);
            exit(json_encode(["error" => "Missing category, chart_name, or comment_text"]));
        }

        $chartSnapshot = isset($input['chart_snapshot']) ? $input['chart_snapshot'] : null;

        // Fetch the user's ID securely using their session username
        $userStmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $userStmt->execute([$_SESSION['username']]);
        $userId = $userStmt->fetchColumn();

        if (!$userId) {
            http_response_code(404);
            exit(json_encode(["error" => "User not found"]));
        }

        $stmt = $pdo->prepare("INSERT INTO reports (user_id, category, chart_name, comment_text, chart_snapshot) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $input['category'], $input['chart_name'], $input['comment_text'], $chartSnapshot]);
        
        http_response_code(201);
        echo json_encode(["message" => "Report saved successfully"]);
        break;

    case 'GET':
        // Join with the users table to get the author's username
        $stmt = $pdo->query("
            SELECT r.id, r.category, r.chart_name, r.comment_text, r.chart_snapshot, r.created_at, u.username 
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            ORDER BY r.created_at DESC
        ");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'DELETE':
        // Only super admins can delete reports
        if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'super_admin') {
            http_response_code(403);
            exit(json_encode(["error" => "Forbidden: Only Super Admins can delete reports."]));
        }

        $input = json_decode(file_get_contents("php://input"), true);
        $reportId = null;

        if (isset($_GET['id']) && is_numeric($_GET['id'])) {
            $reportId = intval($_GET['id']);
        } elseif (isset($input['id']) && is_numeric($input['id'])) {
            $reportId = intval($input['id']);
        }

        if (!$reportId) {
            http_response_code(400);
            exit(json_encode(["error" => "Missing or invalid report id."]));
        }

        $stmt = $pdo->prepare("DELETE FROM reports WHERE id = ?");
        $stmt->execute([$reportId]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            exit(json_encode(["error" => "Report not found."]));
        }

        echo json_encode(["message" => "Report deleted successfully."]);
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
        break;
}
?>