<?php
session_start();
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH");

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
$request_uri = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
$id = (isset($request_uri[2]) && is_numeric($request_uri[2])) ? intval($request_uri[2]) : null;
$input = json_decode(file_get_contents("php://input"), true);

// Only Super Admins can mutate data
if (in_array($method, ['PUT', 'PATCH', 'DELETE'])) {
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'super_admin') {
        http_response_code(403);
        exit(json_encode(["error" => "Forbidden: Only Super Admins can modify or delete records."]));
    }
}

switch ($method) {  
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, session_id, event_type, created_at, raw_data FROM events WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
        } else {
            $stmt = $pdo->query("SELECT id, session_id, event_type, created_at, raw_data FROM events ORDER BY created_at DESC LIMIT 10000");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        }
        break;

    case 'POST':
        if (!isset($input['session_id']) || !isset($input['event_type'])) {
            http_response_code(400);
            echo json_encode(["error" => "Missing required fields: session_id, event_type"]);
            break;
        }
        $rawData = isset($input['raw_data']) ? json_encode($input['raw_data']) : null;
        $stmt = $pdo->prepare("INSERT INTO events (session_id, event_type, raw_data) VALUES (?, ?, ?)");
        $stmt->execute([$input['session_id'], $input['event_type'], $rawData]);
        http_response_code(201);
        echo json_encode(["message" => "Event created", "id" => $pdo->lastInsertId()]);
        break;

    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(["error" => "ID is required for PUT request"]);
            break;
        }
        $rawData = isset($input['raw_data']) ? json_encode($input['raw_data']) : null;
        $stmt = $pdo->prepare("UPDATE events SET session_id = ?, event_type = ?, raw_data = ? WHERE id = ?");
        $stmt->execute([$input['session_id'], $input['event_type'], $rawData, $id]);
        echo json_encode(["message" => "Event ID: $id fully updated"]);
        break;

    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(["error" => "ID is required for DELETE request"]);
            break;
        }
        $stmt = $pdo->prepare("DELETE FROM events WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["message" => "Event ID: $id deleted"]);
        break;

    case 'PATCH':
        if (!$id) {
            http_response_code(400);
            echo json_encode(["error" => "ID is required for PATCH request"]);
            break;
        }
        $fields = [];
        $values = [];
        if (isset($input['session_id'])) { $fields[] = "session_id = ?"; $values[] = $input['session_id']; }
        if (isset($input['event_type'])) { $fields[] = "event_type = ?"; $values[] = $input['event_type']; }
        if (isset($input['raw_data'])) { $fields[] = "raw_data = ?"; $values[] = json_encode($input['raw_data']); }
        
        if (count($fields) > 0) {
            $values[] = $id;
            $sql = "UPDATE events SET " . implode(", ", $fields) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);
            echo json_encode(["message" => "Event ID: $id partially updated"]);
        } else {
            http_response_code(400);
            echo json_encode(["message" => "No valid fields provided for update"]);
        }
        break;
}
?>