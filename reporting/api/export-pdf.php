<?php
session_start();
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit();
}

$reportId = isset($input['report_id']) ? intval($input['report_id']) : 0;
$pdfBase64Uri = isset($input['pdf_base64']) ? trim($input['pdf_base64']) : '';

if ($reportId <= 0 || $pdfBase64Uri === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: report_id, pdf_base64']);
    exit();
}

$parts = explode(',', $pdfBase64Uri, 2);
$pdfBase64 = isset($parts[1]) ? $parts[1] : $parts[0];
$pdfBase64 = preg_replace('/\s+/', '', $pdfBase64);

if ($pdfBase64 === null || $pdfBase64 === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid PDF base64 data']);
    exit();
}

$pdfBinary = base64_decode($pdfBase64, true);
if ($pdfBinary === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Failed to decode PDF data']);
    exit();
}

$exportsDir = realpath(__DIR__ . '/..');
if ($exportsDir === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to resolve reporting base path']);
    exit();
}

$exportsDir .= DIRECTORY_SEPARATOR . 'exports';
if (!is_dir($exportsDir) && !mkdir($exportsDir, 0775, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to create exports directory']);
    exit();
}

$fileName = 'analytics-report-' . $reportId . '.pdf';
$filePath = $exportsDir . DIRECTORY_SEPARATOR . $fileName;

$bytesWritten = file_put_contents($filePath, $pdfBinary);
if ($bytesWritten === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save PDF file']);
    exit();
}

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$reportingBasePath = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/\\');
$publicUrl = $scheme . '://' . $host . $reportingBasePath . '/exports/' . rawurlencode($fileName);

echo json_encode([
    'message' => 'PDF saved to server!',
    'url' => $publicUrl
]);
