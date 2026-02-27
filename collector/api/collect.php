<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    http_response_code(400);
    exit("Invalid JSON");
}

$host = 'localhost';
$db   = 'analytics_db';
$user = 'analytics_user';
$pass = 'SuperSecurePass123!';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare("INSERT INTO events (session_id, event_type, url, raw_data) VALUES (?, ?, ?, ?)");
    $stmt->execute([
        $data['session'] ?? 'unknown',
        $data['type'] ?? 'unknown',
        $data['url'] ?? 'unknown',
        $json
    ]);

    http_response_code(200);
    echo json_encode(["status" => "success"]);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>