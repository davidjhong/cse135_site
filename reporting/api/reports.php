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
        if (!isset($input['category']) || !isset($input['comment_text'])) {
            http_response_code(400);
            exit(json_encode(["error" => "Missing category or comment_text"]));
        }

        // Fetch the user's ID securely using their session username
        $userStmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $userStmt->execute([$_SESSION['username']]);
        $userId = $userStmt->fetchColumn();

        if (!$userId) {
            http_response_code(404);
            exit(json_encode(["error" => "User not found"]));
        }

        $stmt = $pdo->prepare("INSERT INTO reports (user_id, category, comment_text) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $input['category'], $input['comment_text']]);
        
        http_response_code(201);
        echo json_encode(["message" => "Report saved successfully"]);
        break;

    case 'GET':
        // Join with the users table to get the author's username
        $stmt = $pdo->query("
            SELECT r.id, r.category, r.comment_text, r.created_at, u.username 
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            ORDER BY r.created_at DESC
        ");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;
}
?>