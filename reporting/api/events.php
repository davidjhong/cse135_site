<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");

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

// Extract the ID from the URL (e.g., /api/events/3 -> id = 3)
$request_uri = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
$id = (isset($request_uri[2]) && is_numeric($request_uri[2])) ? intval($request_uri[2]) : null;

switch ($method) {
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, session_id, event_type, created_at FROM events WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
        } else {
            $stmt = $pdo->query("SELECT id, session_id, event_type, created_at FROM events ORDER BY created_at DESC LIMIT 10");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        }
        break;
    case 'POST':
        echo json_encode(["message" => "POST request received to create a new event."]);
        break;
    case 'PUT':
        echo json_encode(["message" => "PUT request received to update event ID: $id"]);
        break;
    case 'DELETE':
        echo json_encode(["message" => "DELETE request received to delete event ID: $id"]);
        break;
}
?>