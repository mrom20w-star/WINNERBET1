<?php
/**
 * 1X WINNER - لوحة تحكم الإدارة الرسمية المتقدمة (PHP Admin Dashboard)
 * نظام إدارة العمليات، تتبع أجهزة اللاعبين والمستخدمين، حذف وحظر الأجهزة نهائياً
 */

error_reporting(E_ALL & ~E_NOTICE);
ini_set('display_errors', '0');

// Firebase Realtime Database Configuration
define('FB_DB_URL', 'https://ssss-de880-default-rtdb.firebaseio.com/');
define('LOCAL_DATA_DIR', __DIR__ . '/data/');

if (!is_dir(LOCAL_DATA_DIR)) {
    @mkdir(LOCAL_DATA_DIR, 0777, true);
}

// -------------------------------------------------------------
// Helper Functions for Firebase REST API
// -------------------------------------------------------------
function fb_request($path, $method = 'GET', $data = null) {
    $url = rtrim(FB_DB_URL, '/') . '/' . ltrim($path, '/') . '.json';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    if ($data !== null) {
        $json = is_string($data) ? $data : json_encode($data);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'code' => $httpCode,
        'data' => json_decode($response, true),
        'raw' => $response
    ];
}

function fb_get($path) {
    $res = fb_request($path, 'GET');
    return $res['data'] ?: [];
}

function fb_put($path, $data) {
    return fb_request($path, 'PUT', $data);
}

function fb_patch($path, $data) {
    return fb_request($path, 'PATCH', $data);
}

function fb_delete($path) {
    return fb_request($path, 'DELETE');
}

function safe_date($ts) {
    if (empty($ts)) return 'حديثاً';
    $intSec = intval(round(floatval($ts) / 1000));
    return $intSec > 0 ? date('Y-m-d H:i', $intSec) : 'حديثاً';
}

function safe_time_ago($ts) {
    if (empty($ts)) return 'الآن';
    $sec = intval(round(floatval($ts) / 1000));
    if ($sec <= 0) return 'حديثاً';
    $diff = time() - $sec;
    if ($diff < 60) return 'منذ لحظات';
    if ($diff < 3600) return 'منذ ' . floor($diff / 60) . ' دقيقة';
    if ($diff < 86400) return 'منذ ' . floor($diff / 3600) . ' ساعة';
    return 'منذ ' . floor($diff / 86400) . ' يوم';
}

function safe_first_char($str) {
    if (function_exists('mb_substr')) {
        return mb_substr($str, 0, 1, 'UTF-8');
    }
    return substr($str, 0, 1);
}

// -------------------------------------------------------------
// AJAX API Request Handling (JSON responses for live operations)
// -------------------------------------------------------------
if (isset($_GET['action'])) {
    header('Content-Type: application/json; charset=utf-8');
    $action = $_GET['action'];
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

    // 1. Permanently Ban and Delete User and Device
    if ($action === 'delete_ban_user') {
        $userId = trim($input['userId'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $deviceId = trim($input['deviceId'] ?? '');
        $username = trim($input['username'] ?? 'لاعب');
        $reason = trim($input['reason'] ?? 'تم الحظر والحذف نهائياً بواسطة الإدارة');
        $now = time() * 1000;

        if (!$userId && !$phone && !$deviceId) {
            echo json_encode(['success' => false, 'error' => 'بيانات المستخدم غير مكتملة']);
            exit;
        }

        $banRecord = [
            'userId' => $userId,
            'phone' => $phone,
            'deviceId' => $deviceId,
            'username' => $username,
            'bannedAt' => $now,
            'reason' => $reason
        ];

        // A. Ban by User ID
        if ($userId) {
            fb_put("banned_users/{$userId}", $banRecord);
            // Delete user from active users
            fb_delete("users/{$userId}");
        }

        // B. Ban by Phone Number
        if ($phone) {
            $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
            if ($cleanPhone) {
                fb_put("banned_users/{$cleanPhone}", $banRecord);
            }
        }

        // C. Ban by Device ID / Fingerprint
        if ($deviceId) {
            $safeDeviceKey = preg_replace('/[.#$[\]]/', '_', $deviceId);
            fb_put("banned_devices/{$safeDeviceKey}", $banRecord);
        }

        // D. Save to local banned file as well
        $localBannedFile = LOCAL_DATA_DIR . 'banned.json';
        $localBanned = file_exists($localBannedFile) ? json_decode(file_get_contents($localBannedFile), true) : [];
        $localBanned[$userId ?: ($phone ?: $deviceId)] = $banRecord;
        @file_put_contents($localBannedFile, json_encode($localBanned, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        echo json_encode([
            'success' => true,
            'message' => "تم حذف المستخدم (ID: {$userId}) وحظر الجهاز ({$deviceId}) ورقم الهاتف نهائياً من المنصة."
        ]);
        exit;
    }

    // 2. Unban User or Device
    if ($action === 'unban') {
        $key = trim($input['identifier'] ?? '');
        if (!$key) {
            echo json_encode(['success' => false, 'error' => 'المعرف مطلوب']);
            exit;
        }

        $safeKey = preg_replace('/[.#$[\]]/', '_', $key);
        fb_delete("banned_users/{$safeKey}");
        fb_delete("banned_devices/{$safeKey}");

        // Also clean local banned file
        $localBannedFile = LOCAL_DATA_DIR . 'banned.json';
        if (file_exists($localBannedFile)) {
            $localBanned = json_decode(file_get_contents($localBannedFile), true) ?: [];
            unset($localBanned[$key], $localBanned[$safeKey]);
            @file_put_contents($localBannedFile, json_encode($localBanned, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        echo json_encode(['success' => true, 'message' => "تم رفع الحظر بنجاح عن {$key}."]);
        exit;
    }

    // 3. Approve Deposit
    if ($action === 'approve_deposit') {
        $txId = trim($input['txId'] ?? '');
        if (!$txId) {
            echo json_encode(['success' => false, 'error' => 'كود المعاملة مطلوب']);
            exit;
        }

        $tx = fb_get("transactions/{$txId}");
        if (!$tx || empty($tx['userId'])) {
            echo json_encode(['success' => false, 'error' => 'لم يتم العثور على المعاملة']);
            exit;
        }

        $userId = $tx['userId'];
        $amount = floatval($tx['amount'] ?? 0);

        // Update transaction status
        fb_patch("transactions/{$txId}", ['status' => 'completed']);

        // Update user balance
        $user = fb_get("users/{$userId}");
        if ($user) {
            $currentBal = floatval($user['balance'] ?? 0);
            $currentDep = floatval($user['totalDeposited'] ?? 0);
            $newBal = round($currentBal + $amount, 2);
            $newDep = round($currentDep + $amount, 2);

            fb_patch("users/{$userId}", [
                'balance' => $newBal,
                'totalDeposited' => $newDep,
                'lastSeen' => time() * 1000
            ]);
        }

        echo json_encode(['success' => true, 'message' => "تمت الموافقة على إيداع {$amount} ج.م وإضافتها لرصيد اللاعب بنجاح."]);
        exit;
    }

    // 4. Reject Deposit
    if ($action === 'reject_deposit') {
        $txId = trim($input['txId'] ?? '');
        $reason = trim($input['reason'] ?? 'لم يتم استلام التحويل');
        fb_patch("transactions/{$txId}", ['status' => 'rejected', 'note' => $reason]);
        echo json_encode(['success' => true, 'message' => 'تم رفض الإيداع']);
        exit;
    }

    // 5. Approve Withdrawal
    if ($action === 'approve_withdraw') {
        $txId = trim($input['txId'] ?? '');
        fb_patch("transactions/{$txId}", ['status' => 'completed']);
        echo json_encode(['success' => true, 'message' => 'تم تأكيد تحويل السحب للاعب بنجاح.']);
        exit;
    }

    // 6. Reject Withdrawal
    if ($action === 'reject_withdraw') {
        $txId = trim($input['txId'] ?? '');
        $reason = trim($input['reason'] ?? 'رقم المحفظة غير صحيح');
        $tx = fb_get("transactions/{$txId}");
        if ($tx && !empty($tx['userId'])) {
            $userId = $tx['userId'];
            $amount = floatval($tx['amount'] ?? 0);
            $user = fb_get("users/{$userId}");
            if ($user) {
                $curBal = floatval($user['balance'] ?? 0);
                fb_patch("users/{$userId}", ['balance' => round($curBal + $amount, 2)]);
            }
        }
        fb_patch("transactions/{$txId}", ['status' => 'rejected', 'note' => $reason]);
        echo json_encode(['success' => true, 'message' => 'تم رفض طلب السحب وإرجاع المبلغ لمحفظة اللاعب.']);
        exit;
    }

    // 7. Direct Top-up
    if ($action === 'direct_recharge') {
        $userId = trim($input['userId'] ?? '');
        $amount = floatval($input['amount'] ?? 0);
        if (!$userId || $amount <= 0) {
            echo json_encode(['success' => false, 'error' => 'معرف اللاعب والمبلغ مطلوبان']);
            exit;
        }

        $user = fb_get("users/{$userId}");
        if (!$user) {
            echo json_encode(['success' => false, 'error' => 'لم يتم العثور على اللاعب']);
            exit;
        }

        $curBal = floatval($user['balance'] ?? 0);
        $newBal = round($curBal + $amount, 2);
        fb_patch("users/{$userId}", ['balance' => $newBal]);

        // Create transaction record
        $txId = 'TX-ADMIN-' . rand(100000, 999999);
        fb_put("transactions/{$txId}", [
            'id' => $txId,
            'userId' => $userId,
            'userName' => $user['username'] ?? 'لاعب',
            'userPhone' => $user['phone'] ?? '',
            'type' => 'deposit',
            'amount' => $amount,
            'method' => 'شحن يدوي مباشر من الإدارة',
            'status' => 'completed',
            'timestamp' => time() * 1000,
            'note' => 'شحن رصيد بواسطة مسؤول النظام'
        ]);

        echo json_encode(['success' => true, 'message' => "تم شحن {$amount} ج.م للاعب بنجاح. الرصيد الجديد: {$newBal} ج.م"]);
        exit;
    }

    // 7b. Update / Set / Deduct User Balance from Player Profile
    if ($action === 'update_user_balance') {
        $userId = trim($input['userId'] ?? '');
        $mode = trim($input['mode'] ?? 'add'); // 'add', 'deduct', 'set'
        $amount = floatval($input['amount'] ?? 0);

        if (!$userId) {
            echo json_encode(['success' => false, 'error' => 'معرف المستخدم غير محدد']);
            exit;
        }

        $user = fb_get("users/{$userId}");
        if (!$user) {
            echo json_encode(['success' => false, 'error' => 'اللاعب غير مسجل في قاعدة البيانات']);
            exit;
        }

        $oldBal = floatval($user['balance'] ?? 0);
        $newBal = $oldBal;
        $note = '';

        if ($mode === 'add') {
            $newBal = round($oldBal + $amount, 2);
            $note = "إضافة رصيد مباشر (+{$amount} ج.م)";
        } elseif ($mode === 'deduct') {
            $newBal = max(0, round($oldBal - $amount, 2));
            $note = "خصم رصيد مباشر (-{$amount} ج.م)";
        } elseif ($mode === 'set') {
            $newBal = max(0, round($amount, 2));
            $note = "تعديل الرصيد يدوياً إلى ({$newBal} ج.م)";
        }

        fb_patch("users/{$userId}", ['balance' => $newBal]);

        // Record admin audit transaction
        $txId = 'TX-BAL-' . rand(100000, 999999);
        fb_put("transactions/{$txId}", [
            'id' => $txId,
            'userId' => $userId,
            'userName' => $user['username'] ?? 'لاعب',
            'userPhone' => $user['phone'] ?? '',
            'type' => $mode === 'deduct' ? 'withdraw' : 'deposit',
            'amount' => abs($newBal - $oldBal),
            'method' => 'لوحة التحكم - إدارة الرصيد',
            'status' => 'completed',
            'timestamp' => round(microtime(true) * 1000),
            'note' => $note
        ]);

        echo json_encode([
            'success' => true,
            'message' => "تم تحديث رصيد اللاعب ({$user['username']}) إلى " . number_format($newBal, 2) . " ج.م بنجاح",
            'newBalance' => $newBal
        ]);
        exit;
    }

    // 7c. Toggle User Ban / Unban from Profile
    if ($action === 'toggle_user_ban') {
        $userId = trim($input['userId'] ?? '');
        $ban = !empty($input['ban']);

        if (!$userId) {
            echo json_encode(['success' => false, 'error' => 'معرف المستخدم غير محدد']);
            exit;
        }

        $user = fb_get("users/{$userId}") ?: [];
        $devId = $user['deviceId'] ?? '';
        $phone = $user['phone'] ?? '';
        $uname = $user['username'] ?? 'لاعب';

        fb_patch("users/{$userId}", [
            'isBanned' => $ban,
            'banReason' => $ban ? (trim($input['reason'] ?? 'مخالفة شروط الاستخدام') ?: 'مخالفة شروط الاستخدام') : null
        ]);

        $now = round(microtime(true) * 1000);
        if ($ban) {
            fb_put("banned_users/{$userId}", [
                'id' => $userId,
                'username' => $uname,
                'phone' => $phone,
                'deviceId' => $devId,
                'reason' => trim($input['reason'] ?? 'حظر إداري'),
                'bannedAt' => $now
            ]);
            if ($devId) {
                fb_put("banned_devices/{$devId}", [
                    'deviceId' => $devId,
                    'deviceName' => $user['deviceName'] ?? '',
                    'userId' => $userId,
                    'userName' => $uname,
                    'bannedAt' => $now
                ]);
            }
        } else {
            fb_delete("banned_users/{$userId}");
            if ($devId) {
                fb_delete("banned_devices/{$devId}");
            }
        }

        echo json_encode([
            'success' => true,
            'message' => $ban ? "تم حظر اللاعب ({$uname}) وحظر جهازه بنجاح" : "تم فك الحظر عن اللاعب ({$uname}) واستعادة حسابه بنجاح"
        ]);
        exit;
    }

    // 7d. Update User Profit Limit / Game Limits
    if ($action === 'update_user_profit_limit') {
        $userId = trim($input['userId'] ?? '');
        $limit = floatval($input['limit'] ?? 0);
        $enabled = !empty($input['enabled']);

        if (!$userId) {
            echo json_encode(['success' => false, 'error' => 'معرف اللاعب غير محدد']);
            exit;
        }

        fb_patch("users/{$userId}", [
            'customProfitLimit' => $limit,
            'profitLimitEnabled' => $enabled
        ]);

        echo json_encode([
            'success' => true,
            'message' => $enabled ? "تم ضبط الحد الأقصى لأرباح اللاعب على " . number_format($limit, 2) . " ج.م" : "تم إلغاء تفعيل حد الأرباح لهذا اللاعب"
        ]);
        exit;
    }

    // 7e. Force Logout / Disconnect Player Session
    if ($action === 'force_logout_user') {
        $userId = trim($input['userId'] ?? '');
        if ($userId) {
            fb_patch("users/{$userId}", [
                'isOnline' => false,
                'forceLogout' => true,
                'lastLogoutAt' => round(microtime(true) * 1000)
            ]);
            echo json_encode(['success' => true, 'message' => 'تم تسجيل خروج اللاعب وإيقاف جلسته النشطة فوراً']);
        } else {
            echo json_encode(['success' => false, 'error' => 'معرف اللاعب غير محدد']);
        }
        exit;
    }

    // 8. Save Settings
    if ($action === 'save_settings') {
        $settings = [
            'vodafoneNumber' => trim($input['vodafoneNumber'] ?? '01098688815'),
            'etisalatNumber' => trim($input['etisalatNumber'] ?? '01123456789'),
            'orangeNumber' => trim($input['orangeNumber'] ?? '01234567890'),
            'instapayNumber' => trim($input['instapayNumber'] ?? '01098688815'),
            'minDeposit' => floatval($input['minDeposit'] ?? 10),
            'minWithdraw' => floatval($input['minWithdraw'] ?? 50),
            'platformName' => '1X WINNER',
            'autoApproveDeposits' => false
        ];
        fb_put("settings", $settings);
        echo json_encode(['success' => true, 'message' => 'تم حفظ وتحديث إعدادات المحافظ بنجاح']);
        exit;
    }

    // 9. Crash multiplier
    if ($action === 'set_crash_multiplier') {
        $multiplier = floatval($input['multiplier'] ?? 0);
        fb_put("forced_crash_multiplier", $multiplier > 1 ? $multiplier : null);
        echo json_encode(['success' => true, 'message' => 'تم تثبيت نتيجة لعبة الطيارة']);
        exit;
    }

    // 10. Reply Support
    if ($action === 'reply_support') {
        $ticketId = trim($input['ticketId'] ?? '');
        $userId = trim($input['userId'] ?? '');
        $text = trim($input['text'] ?? '');
        
        if (!$ticketId && $userId) {
            $ticketId = "CHAT-{$userId}";
        }

        if ($ticketId && $text) {
            $ticket = fb_get("support_tickets/{$ticketId}");
            if (!$ticket && $userId) {
                // Look for existing ticket by userId
                $allTickets = fb_get("support_tickets") ?: [];
                foreach ($allTickets as $tId => $t) {
                    if (($t['userId'] ?? '') === $userId) {
                        $ticketId = $tId;
                        $ticket = $t;
                        break;
                    }
                }
            }

            $nowMs = round(microtime(true) * 1000);
            $newMsg = [
                'id' => 'MSG-' . rand(100000, 999999),
                'sender' => 'admin',
                'senderName' => 'خدمة العملاء (1X WINNER)',
                'text' => $text,
                'timestamp' => $nowMs
            ];

            if ($ticket) {
                $messages = $ticket['messages'] ?? [];
                $messages[] = $newMsg;
                fb_patch("support_tickets/{$ticketId}", [
                    'messages' => $messages,
                    'status' => 'open',
                    'updatedAt' => $nowMs
                ]);
            } else {
                $user = $userId ? (fb_get("users/{$userId}") ?: []) : [];
                $ticket = [
                    'id' => $ticketId,
                    'userId' => $userId ?: 'N/A',
                    'userName' => $user['username'] ?? 'لاعب',
                    'userPhone' => $user['phone'] ?? '',
                    'subject' => 'محادثة دعم فني مباشر',
                    'messages' => [$newMsg],
                    'status' => 'open',
                    'createdAt' => $nowMs,
                    'updatedAt' => $nowMs
                ];
                fb_put("support_tickets/{$ticketId}", $ticket);
            }

            echo json_encode([
                'success' => true,
                'message' => 'تم إرسال الرد بنجاح',
                'ticketId' => $ticketId,
                'newMessage' => $newMsg
            ]);
            exit;
        }
        echo json_encode(['success' => false, 'error' => 'الرسالة ومعرف التذكرة مطلوبان']);
        exit;
    }

    // 10b. Get Support Chat Thread
    if ($action === 'get_support_thread') {
        $ticketId = trim($input['ticketId'] ?? '');
        $userId = trim($input['userId'] ?? '');
        $allTickets = fb_get("support_tickets") ?: [];
        $foundTicket = null;

        if ($ticketId && isset($allTickets[$ticketId])) {
            $foundTicket = $allTickets[$ticketId];
        } else if ($userId) {
            foreach ($allTickets as $tId => $t) {
                if (($t['userId'] ?? '') === $userId) {
                    $foundTicket = $t;
                    $foundTicket['id'] = $tId;
                    break;
                }
            }
        }

        echo json_encode([
            'success' => true,
            'ticket' => $foundTicket,
            'messages' => $foundTicket['messages'] ?? []
        ]);
        exit;
    }

    // 11. Delete Specific Transaction (Deposit or Withdrawal)
    if ($action === 'delete_transaction') {
        $txId = trim($input['txId'] ?? '');
        if ($txId) {
            fb_delete("transactions/{$txId}");
            echo json_encode(['success' => true, 'message' => "تم مسح المعاملة ({$txId}) بنجاح"]);
        } else {
            echo json_encode(['success' => false, 'error' => 'رقم المعاملة غير محدد']);
        }
        exit;
    }

    // 12. Delete User Without Ban
    if ($action === 'delete_user_only') {
        $userId = trim($input['userId'] ?? '');
        if ($userId) {
            fb_delete("users/{$userId}");
            echo json_encode(['success' => true, 'message' => "تم مسح حساب المستخدم ({$userId}) بنجاح"]);
        } else {
            echo json_encode(['success' => false, 'error' => 'معرف المستخدم غير محدد']);
        }
        exit;
    }

    // 13. Delete Support Ticket
    if ($action === 'delete_ticket') {
        $ticketId = trim($input['ticketId'] ?? '');
        if ($ticketId) {
            fb_delete("support_tickets/{$ticketId}");
            echo json_encode(['success' => true, 'message' => "تم مسح التذكرة بنجاح"]);
        } else {
            echo json_encode(['success' => false, 'error' => 'رقم التذكرة غير محدد']);
        }
        exit;
    }

    // 14. Master Zero Reset: Wipe all data to zero (start completely fresh)
    if ($action === 'reset_all_data') {
        fb_put("transactions", new stdClass());
        fb_put("users", new stdClass());
        fb_put("support_tickets", new stdClass());
        fb_put("banned_users", new stdClass());
        fb_put("banned_devices", new stdClass());
        if (is_dir(LOCAL_DATA_DIR)) {
            @array_map('unlink', glob(LOCAL_DATA_DIR . '*'));
        }
        echo json_encode([
            'success' => true,
            'message' => 'تم تصفير كافة بيانات المنصة بالكامل (0 مستخدمين - 0 طلبات - 0 تذاكر). يمكنك الآن البدء من جديد تماماً!'
        ]);
        exit;
    }

    // 15. Clear all transactions only (zero out deposits and withdrawals)
    if ($action === 'clear_transactions_only') {
        fb_put("transactions", new stdClass());
        echo json_encode(['success' => true, 'message' => 'تم تصفير ومسح جميع طلبات الإيداع والسحب بنجاح']);
        exit;
    }

    // 16. Live Background Polling Endpoint (Online players, pending alerts, live stats)
    if ($action === 'get_live_data') {
        $rawUsers = fb_get('users') ?: [];
        $rawTxs = fb_get('transactions') ?: [];
        $nowMs = time() * 1000;

        $onlineCount = 0;
        $usersData = [];
        foreach ($rawUsers as $k => $u) {
            $u['id'] = $u['id'] ?? $k;
            $lastSeen = floatval($u['lastSeen'] ?? 0);
            $isOnline = (!empty($u['isOnline']) || ($nowMs - $lastSeen < 60000));
            if ($isOnline) $onlineCount++;
            $u['isCurrentlyOnline'] = $isOnline;
            $usersData[] = $u;
        }

        $pendingDeposits = 0;
        $pendingWithdraws = 0;
        $txsData = [];
        foreach ($rawTxs as $k => $t) {
            $t['id'] = $t['id'] ?? $k;
            if (($t['type'] ?? '') === 'deposit' && ($t['status'] ?? '') === 'pending') {
                $pendingDeposits++;
            }
            if (($t['type'] ?? '') === 'withdraw' && ($t['status'] ?? '') === 'pending') {
                $pendingWithdraws++;
            }
            $txsData[] = $t;
        }

        $bannedU = fb_get('banned_users') ?: [];
        $bannedD = fb_get('banned_devices') ?: [];

        echo json_encode([
            'success' => true,
            'onlineCount' => $onlineCount,
            'totalUsers' => count($usersData),
            'pendingDeposits' => $pendingDeposits,
            'pendingWithdraws' => $pendingWithdraws,
            'totalBanned' => count($bannedU) + count($bannedD),
            'users' => $usersData,
            'transactions' => $txsData,
            'serverTime' => $nowMs
        ]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Action not recognized']);
    exit;
}

// -------------------------------------------------------------
// Fetch Live Data for Initial Page Render
// -------------------------------------------------------------
$rawUsers = fb_get('users') ?: [];
$usersList = [];
foreach ($rawUsers as $k => $u) {
    $u['id'] = $u['id'] ?? $k;
    $usersList[] = $u;
}

$rawTxs = fb_get('transactions') ?: [];
$txsList = [];
foreach ($rawTxs as $k => $t) {
    $t['id'] = $t['id'] ?? $k;
    $txsList[] = $t;
}
usort($txsList, function($a, $b) {
    return ($b['timestamp'] ?? 0) - ($a['timestamp'] ?? 0);
});

$depositsList = array_filter($txsList, function($t) { return ($t['type'] ?? '') === 'deposit'; });
$withdrawsList = array_filter($txsList, function($t) { return ($t['type'] ?? '') === 'withdraw'; });

$bannedUsers = fb_get('banned_users') ?: [];
$bannedDevices = fb_get('banned_devices') ?: [];

$settings = fb_get('settings') ?: [
    'vodafoneNumber' => '01098688815',
    'etisalatNumber' => '01123456789',
    'orangeNumber' => '01234567890',
    'instapayNumber' => '01098688815',
    'minDeposit' => 10,
    'minWithdraw' => 50
];

$supportTickets = fb_get('support_tickets') ?: [];

// Summary metrics & Online Users detection
$nowMs = round(microtime(true) * 1000);
$onlineUsersCount = 0;
foreach ($usersList as &$u) {
    $lastSeen = intval($u['lastSeen'] ?? 0);
    $isOnlineFlag = !empty($u['isOnline']);
    $isCurrentlyOnline = ($isOnlineFlag && ($nowMs - $lastSeen) < 120000) || (($nowMs - $lastSeen) < 60000);
    $u['isCurrentlyOnline'] = $isCurrentlyOnline;
    if ($isCurrentlyOnline) {
        $onlineUsersCount++;
    }
}
unset($u);

$totalUsersCount = count($usersList);
$totalBalance = array_sum(array_map(function($u) { return floatval($u['balance'] ?? 0); }, $usersList));

$pendingDepositsCount = count(array_filter($depositsList, function($t) { return ($t['status'] ?? '') === 'pending'; }));
$completedDepositsCount = count(array_filter($depositsList, function($t) { return ($t['status'] ?? '') === 'completed'; }));
$rejectedDepositsCount = count(array_filter($depositsList, function($t) { return ($t['status'] ?? '') === 'rejected'; }));

$pendingWithdrawsCount = count(array_filter($withdrawsList, function($t) { return ($t['status'] ?? '') === 'pending'; }));
$completedWithdrawsCount = count(array_filter($withdrawsList, function($t) { return ($t['status'] ?? '') === 'completed'; }));
$rejectedWithdrawsCount = count(array_filter($withdrawsList, function($t) { return ($t['status'] ?? '') === 'rejected'; }));

$totalBannedCount = count($bannedUsers) + count($bannedDevices);

// Map users by id for quick lookup and per-user stats
$userTxMap = [];
foreach ($txsList as $tx) {
    $uid = $tx['userId'] ?? '';
    if ($uid) {
        if (!isset($userTxMap[$uid])) {
            $userTxMap[$uid] = [
                'depositsTotal' => 0,
                'depositsCount' => 0,
                'withdrawsTotal' => 0,
                'withdrawsCount' => 0,
                'transactions' => []
            ];
        }
        $userTxMap[$uid]['transactions'][] = $tx;
        $amt = floatval($tx['amount'] ?? 0);
        $st = $tx['status'] ?? 'pending';
        $type = $tx['type'] ?? '';
        if ($type === 'deposit') {
            $userTxMap[$uid]['depositsCount']++;
            if ($st === 'completed') {
                $userTxMap[$uid]['depositsTotal'] += $amt;
            }
        } elseif ($type === 'withdraw') {
            $userTxMap[$uid]['withdrawsCount']++;
            if ($st === 'completed') {
                $userTxMap[$uid]['withdrawsTotal'] += $amt;
            }
        }
    }
}

$usersMap = [];
foreach ($usersList as &$u) {
    $uid = $u['id'] ?? '';
    $uStats = $userTxMap[$uid] ?? [
        'depositsTotal' => 0,
        'depositsCount' => 0,
        'withdrawsTotal' => 0,
        'withdrawsCount' => 0,
        'transactions' => []
    ];
    $u['depositsTotal'] = $uStats['depositsTotal'];
    $u['depositsCount'] = $uStats['depositsCount'];
    $u['withdrawsTotal'] = $uStats['withdrawsTotal'];
    $u['withdrawsCount'] = $uStats['withdrawsCount'];
    $u['transactions'] = $uStats['transactions'];
    if (!empty($uid)) {
        $usersMap[$uid] = $u;
    }
}
unset($u);

// Group support tickets by user so each user has their dedicated WhatsApp chat
$userChats = [];
foreach ($supportTickets as $tId => $ticket) {
    $uid = $ticket['userId'] ?? $ticket['userPhone'] ?? $tId;
    $userInfo = $usersMap[$uid] ?? null;
    $uname = $ticket['userName'] ?? ($userInfo['username'] ?? 'لاعب');
    $uphone = $ticket['userPhone'] ?? ($userInfo['phone'] ?? '');

    if (!isset($userChats[$uid])) {
        $userChats[$uid] = [
            'ticketId' => $tId,
            'userId' => $uid,
            'userName' => $uname,
            'userPhone' => $uphone,
            'subject' => $ticket['subject'] ?? 'محادثة دعم فني مباشر',
            'messages' => $ticket['messages'] ?? [],
            'status' => $ticket['status'] ?? 'open',
            'updatedAt' => $ticket['updatedAt'] ?? ($ticket['createdAt'] ?? 0),
            'balance' => floatval($userInfo['balance'] ?? 0),
            'isOnline' => !empty($userInfo['isCurrentlyOnline']),
        ];
    } else {
        $existingMsgs = $userChats[$uid]['messages'] ?? [];
        $newMsgs = $ticket['messages'] ?? [];
        $userChats[$uid]['messages'] = array_merge($existingMsgs, $newMsgs);
        $userChats[$uid]['updatedAt'] = max($userChats[$uid]['updatedAt'], $ticket['updatedAt'] ?? 0);
    }
}

// Sort chats by latest message timestamp descending
uasort($userChats, function($a, $b) {
    return ($b['updatedAt'] ?? 0) - ($a['updatedAt'] ?? 0);
});
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>لوحة تحكم الإدارة (PHP) - 1X WINNER</title>
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Arabic Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">

  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Tajawal', 'Cairo', 'sans-serif'],
            mono: ['Courier New', 'monospace']
          },
          colors: {
            brand: {
              50: '#eff6ff',
              500: '#3b82f6',
              600: '#2563eb',
              700: '#1d4ed8',
              900: '#1e3a8a'
            }
          }
        }
      }
    };
  </script>

  <style>
    body {
      background-color: #080d1a;
      color: #f1f5f9;
      font-family: 'Tajawal', 'Cairo', sans-serif;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #0b1120;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #1e293b;
      border-radius: 9999px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #334155;
    }
    .badge-glow-red {
      box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
    }
    .badge-glow-green {
      box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
    }
  </style>

  <!-- Firebase Client SDK for live multi-tab synchronization -->
  <script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js"></script>
</head>
<body class="min-h-screen flex flex-col antialiased select-none custom-scrollbar">

  <!-- HEADER -->
  <header class="bg-[#0f172a] border-b border-slate-800 sticky top-0 z-40 shadow-xl backdrop-blur-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 text-xl font-bold">
          ⚡
        </div>
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <h1 class="font-black text-base sm:text-lg text-white tracking-wide">لوحة تحكم الإدارة</h1>
            <span class="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30 font-mono">
              PHP 8.2 ENGINE
            </span>
          </div>
          <span class="text-xs text-slate-400">نظام المراقبة وتتبع أجهزة اللاعبين المباشر وحظر المستخدمين</span>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Live Status Indicator -->
        <div class="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs text-emerald-400 font-bold">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>متصل مباشر</span>
        </div>

        <!-- Reload Data Button -->
        <button 
          onclick="window.location.reload()" 
          class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer" 
          title="تحديث البيانات"
        >
          🔄
        </button>
      </div>
    </div>
  </header>

  <!-- MAIN CONTAINER -->
  <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 flex-1">

    <!-- TOP SUMMARY STATS -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      <!-- Stat 1: Total Users -->
      <div class="bg-[#111c33] border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-1 shadow-md hover:border-slate-700 transition">
        <span class="text-xs text-slate-400 font-medium">👥 إجمالي اللاعبين</span>
        <span class="text-xl sm:text-2xl font-black text-white font-mono" id="stat-total-users"><?= $totalUsersCount ?></span>
        <span class="text-[10px] text-slate-500">حساب مسجل بالمنصة</span>
      </div>

      <!-- Stat 2: Total Balances -->
      <div class="bg-[#111c33] border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-1 shadow-md hover:border-slate-700 transition">
        <span class="text-xs text-slate-400 font-medium">💰 إجمالي الأرصدة</span>
        <div class="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
          <span><?= number_format($totalBalance, 2) ?></span>
          <span class="text-xs text-slate-400 font-normal">ج.م</span>
        </div>
        <span class="text-[10px] text-slate-500">أرصدة اللاعبين الحالية</span>
      </div>

      <!-- Stat 3: Pending Deposits -->
      <div class="bg-[#111c33] border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-1 shadow-md hover:border-slate-700 transition">
        <span class="text-xs text-slate-400 font-medium">📥 طلبات إيداع معلقة</span>
        <span class="text-xl sm:text-2xl font-black <?= $pendingDepositsCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300' ?> font-mono" id="stat-pending-deposits"><?= $pendingDepositsCount ?></span>
        <span class="text-[10px] text-slate-500">في انتظار مراجعة التحويل</span>
      </div>

      <!-- Stat 4: Pending Withdrawals -->
      <div class="bg-[#111c33] border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-1 shadow-md hover:border-slate-700 transition">
        <span class="text-xs text-slate-400 font-medium">📤 طلبات سحب معلقة</span>
        <span class="text-xl sm:text-2xl font-black <?= $pendingWithdrawsCount > 0 ? 'text-purple-400 animate-pulse' : 'text-slate-300' ?> font-mono" id="stat-pending-withdraws"><?= $pendingWithdrawsCount ?></span>
        <span class="text-[10px] text-slate-500">في انتظار تأكيد التحويل</span>
      </div>

      <!-- Stat 5: Online Players Now -->
      <div onclick="filterOnlineStatus('online')" class="bg-[#111c33] border <?= $onlineUsersCount > 0 ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800/90' ?> rounded-2xl p-4 flex flex-col gap-1 shadow-md hover:border-emerald-500 transition cursor-pointer" title="انقر لتصفية اللاعبين المتصلين الآن فقط">
        <div class="flex items-center justify-between">
          <span class="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 <?= $onlineUsersCount > 0 ? 'animate-ping' : '' ?>"></span>
            <span>🟢 المتصلين الآن</span>
          </span>
          <span class="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">ONLINE</span>
        </div>
        <span class="text-xl sm:text-2xl font-black text-emerald-400 font-mono" id="stat-online-users"><?= $onlineUsersCount ?></span>
        <span class="text-[10px] text-slate-400">لاعب نشط داخل المنصة حالياً</span>
      </div>

      <!-- Stat 6: Banned Users & Devices -->
      <div class="bg-[#111c33] border border-red-900/40 rounded-2xl p-4 flex flex-col gap-1 shadow-md hover:border-red-700 transition">
        <span class="text-xs text-red-300 font-medium">🚫 أجهزة وحسابات محظورة</span>
        <span class="text-xl sm:text-2xl font-black text-red-400 font-mono" id="stat-banned"><?= $totalBannedCount ?></span>
        <span class="text-[10px] text-slate-500">ممنوعون من الدخول نهائياً</span>
      </div>
    </div>

    <!-- NAVIGATION TABS -->
    <div class="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 border-b border-slate-800">
      <button onclick="switchTab('devices')" id="tab-btn-devices" class="tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap bg-blue-600 text-white shadow-md shadow-blue-600/30">
        <span>📱</span>
        <span>أجهزة اللاعبين والمستخدمين (المراقبة الحية)</span>
        <span class="bg-blue-800 text-white text-[10px] px-2 py-0.5 rounded-full font-mono"><?= $totalUsersCount ?></span>
      </button>

      <button onclick="switchTab('banned')" id="tab-btn-banned" class="tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap bg-slate-800/80 text-slate-300 hover:text-white">
        <span>🚫</span>
        <span>قائمة المحظورين والممنوعين</span>
        <?php if ($totalBannedCount > 0): ?>
          <span class="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono"><?= $totalBannedCount ?></span>
        <?php endif; ?>
      </button>

      <button onclick="switchTab('deposits')" id="tab-btn-deposits" class="tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap bg-slate-800/80 text-slate-300 hover:text-white">
        <span>📥</span>
        <span>طلبات الإيداع</span>
        <?php if ($pendingDepositsCount > 0): ?>
          <span class="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full animate-bounce"><?= $pendingDepositsCount ?></span>
        <?php endif; ?>
      </button>

      <button onclick="switchTab('withdraws')" id="tab-btn-withdraws" class="tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap bg-slate-800/80 text-slate-300 hover:text-white">
        <span>📤</span>
        <span>طلبات السحب</span>
        <?php if ($pendingWithdrawsCount > 0): ?>
          <span class="bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-bounce"><?= $pendingWithdrawsCount ?></span>
        <?php endif; ?>
      </button>

      <button onclick="switchTab('recharge')" id="tab-btn-recharge" class="tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap bg-slate-800/80 text-slate-300 hover:text-white">
        <span>💳</span>
        <span>شحن مباشر للاعب</span>
      </button>

      <button onclick="switchTab('crash')" id="tab-btn-crash" class="tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap bg-slate-800/80 text-slate-300 hover:text-white">
        <span>✈️</span>
        <span>التحكم بنتيجة الطيارة</span>
      </button>

      <button onclick="switchTab('support')" id="tab-btn-support" class="tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap bg-slate-800/80 text-slate-300 hover:text-white">
        <span>💬</span>
        <span>الدعم الفني</span>
      </button>

      <button onclick="switchTab('settings')" id="tab-btn-settings" class="tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap bg-slate-800/80 text-slate-300 hover:text-white">
        <span>⚙️</span>
        <span>أرقام المحافظ والإعدادات</span>
      </button>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 1: USER PROFILES & DEVICES MONITORING (بروفايل ومربعات اللاعبين) -->
    <!-- ======================================================== -->
    <section id="tab-content-devices" class="tab-content flex flex-col gap-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex flex-col">
          <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <span>👥</span>
            <span>بروفايل وحسابات اللاعبين وأجهزتهم (مراقبة وتحكم فوري)</span>
          </h2>
          <p class="text-xs text-slate-400">
            انقر على أي مربع للاعب لفتح بروفايله بالكامل: فحص الرصيد الفعلي، الشحن والخصم، كشف المعاملات، ضبط حد الأرباح والفرقعة، والحظر الفوري.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- View Toggle: Cards Grid (مربعات) vs Table -->
          <div class="flex items-center bg-[#0b1222] border border-slate-800 rounded-xl p-1 gap-1 text-xs">
            <button 
              type="button" 
              onclick="switchUsersView('cards')" 
              id="users-view-cards-btn" 
              class="px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 bg-blue-600 text-white cursor-pointer shadow-sm"
            >
              <span>▦</span>
              <span>مربعات اللاعبين</span>
            </button>
            <button 
              type="button" 
              onclick="switchUsersView('table')" 
              id="users-view-table-btn" 
              class="px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <span>☰</span>
              <span>جدول تفصيلي</span>
            </button>
          </div>

          <!-- Filter chips for online/offline -->
          <div class="flex items-center bg-[#0b1222] border border-slate-800 rounded-xl p-1 gap-1 text-xs">
            <button onclick="filterOnlineStatus('all')" id="btn-filter-all" class="px-3 py-1.5 rounded-lg font-bold transition bg-blue-600 text-white cursor-pointer">
              الكل (<?= count($usersList) ?>)
            </button>
            <button onclick="filterOnlineStatus('online')" id="btn-filter-online" class="px-3 py-1.5 rounded-lg font-bold transition text-emerald-400 hover:bg-slate-800 flex items-center gap-1 cursor-pointer">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>أونلاين الآن (<?= $onlineUsersCount ?>)</span>
            </button>
            <button onclick="filterOnlineStatus('offline')" id="btn-filter-offline" class="px-3 py-1.5 rounded-lg font-bold transition text-slate-400 hover:bg-slate-800 cursor-pointer">
              غير متصل (<?= count($usersList) - $onlineUsersCount ?>)
            </button>
          </div>

          <input 
            type="text" 
            id="devices-search-input" 
            oninput="filterDevicesTable()" 
            placeholder="🔍 بحث بالاسم، الهاتف، الجهاز، أو الـ ID..." 
            class="bg-[#111c33] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 w-52 sm:w-72 shadow-inner"
          >
        </div>
      </div>

      <!-- ============================================== -->
      <!-- VIEW 1: PLAYER PROFILE CARDS GRID (مربعات اللاعبين) -->
      <!-- ============================================== -->
      <div id="users-cards-view" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <?php if (empty($usersList)): ?>
          <div class="col-span-full bg-[#10192e] border border-slate-800 rounded-3xl p-10 text-center text-slate-500">
            لا يوجد لاعبون مسجلون حالياً في قاعدة البيانات
          </div>
        <?php else: ?>
          <?php foreach ($usersList as $u):
            $uid = htmlspecialchars($u['id'] ?? '');
            $rawUid = $u['id'] ?? '';
            $uname = htmlspecialchars($u['username'] ?? 'لاعب');
            $uphone = htmlspecialchars($u['phone'] ?? '');
            $ubal = number_format(floatval($u['balance'] ?? 0), 2);
            $devName = htmlspecialchars($u['deviceName'] ?? 'هاتف محمول / كمبيوتر');
            $devType = htmlspecialchars($u['deviceType'] ?? 'mobile');
            $devOS = htmlspecialchars($u['deviceOS'] ?? 'غير محدد');
            $devBrowser = htmlspecialchars($u['deviceBrowser'] ?? 'متصفح ويب');
            $devId = htmlspecialchars($u['deviceId'] ?? 'DEV-N/A');
            $lastSeen = safe_date($u['lastSeen'] ?? null);
            $isUserBanned = !empty($u['isBanned']) || isset($bannedUsers[$uid]) || isset($bannedDevices[$devId]);
            $isCurrentlyOnline = !empty($u['isCurrentlyOnline']);
            $depTotal = number_format(floatval($u['depositsTotal'] ?? 0), 2);
            $withTotal = number_format(floatval($u['withdrawsTotal'] ?? 0), 2);
            $depCount = intval($u['depositsCount'] ?? 0);
            $withCount = intval($u['withdrawsCount'] ?? 0);
            $hasProfitCap = !empty($u['profitLimitEnabled']) && floatval($u['customProfitLimit'] ?? 0) > 0;
            $profitCapVal = number_format(floatval($u['customProfitLimit'] ?? 0), 2);
          ?>
          <div 
            onclick="openPlayerProfileModal('<?= $rawUid ?>')"
            class="user-card relative rounded-3xl border transition-all duration-200 cursor-pointer p-5 flex flex-col justify-between gap-4 shadow-xl hover:shadow-2xl hover:-translate-y-1 select-none <?= $isUserBanned ? 'bg-[#180d12] border-red-900/60 opacity-60' : 'bg-[#10192e] hover:bg-[#131e38] border-slate-800/90 hover:border-blue-500/60' ?>"
            data-online="<?= $isCurrentlyOnline ? 'true' : 'false' ?>"
            data-userid="<?= $uid ?>"
            data-search="<?= strtolower("{$uname} {$uid} {$uphone} {$devName} {$devId}") ?>"
          >
            <!-- Card Header: User Info & Status Badges -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black text-base shrink-0 shadow-inner">
                  <?= safe_first_char($uname) ?>
                </div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-black text-white text-sm hover:text-blue-400 transition"><?= $uname ?></span>
                    <?php if ($hasProfitCap): ?>
                      <span class="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30" title="حد أرباح مفعل">
                        🎯 ليميت: <?= $profitCapVal ?> ج.م
                      </span>
                    <?php endif; ?>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5 text-xs">
                    <span class="text-amber-400 font-bold font-mono text-[11px]">ID: #<?= $uid ?></span>
                    <span class="text-slate-500">•</span>
                    <span class="text-slate-400 font-mono text-[11px]"><?= $uphone ?: 'بدون هاتف' ?></span>
                  </div>
                </div>
              </div>

              <!-- Status Badge -->
              <div class="shrink-0">
                <?php if ($isUserBanned): ?>
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    <span>🚫 محظور</span>
                  </span>
                <?php elseif ($isCurrentlyOnline): ?>
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>أونلاين</span>
                  </span>
                <?php else: ?>
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-800/80 border border-slate-700">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    <span>غير متصل</span>
                  </span>
                <?php endif; ?>
              </div>
            </div>

            <!-- Balance Display Box (مربع الرصيد الحالي والشحن السريع) -->
            <div class="bg-[#0b1222] border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between shadow-inner">
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <span>💰</span>
                  <span>الرصيد الحالي للحساب:</span>
                </span>
                <div class="text-xl sm:text-2xl font-black text-emerald-400 font-mono flex items-baseline gap-1 mt-0.5">
                  <span><?= $ubal ?></span>
                  <span class="text-xs text-emerald-500 font-normal">ج.م</span>
                </div>
              </div>

              <div class="flex items-center gap-1.5" onclick="event.stopPropagation()">
                <button 
                  type="button" 
                  onclick="quickRechargePrompt('<?= $rawUid ?>', 100)"
                  class="px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-black border border-emerald-500/30 transition cursor-pointer"
                  title="شحن 100 جنيه فوري"
                >
                  +100
                </button>
                <button 
                  type="button" 
                  onclick="quickRechargePrompt('<?= $rawUid ?>', 500)"
                  class="px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-black border border-emerald-500/30 transition cursor-pointer"
                  title="شحن 500 جنيه فوري"
                >
                  +500
                </button>
              </div>
            </div>

            <!-- Key Metrics Grid -->
            <div class="grid grid-cols-2 gap-2 text-xs">
              <!-- Deposits Info -->
              <div class="bg-[#0b1222]/70 border border-slate-800/60 rounded-xl p-2.5 flex flex-col gap-0.5">
                <span class="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>📥</span>
                  <span>إجمالي الإيداعات:</span>
                </span>
                <span class="font-black text-slate-200 font-mono text-xs"><?= $depTotal ?> ج.م</span>
                <span class="text-[10px] text-slate-500"><?= $depCount ?> عمليات مقبولة</span>
              </div>

              <!-- Withdrawals Info -->
              <div class="bg-[#0b1222]/70 border border-slate-800/60 rounded-xl p-2.5 flex flex-col gap-0.5">
                <span class="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>📤</span>
                  <span>إجمالي السحوبات:</span>
                </span>
                <span class="font-black text-purple-300 font-mono text-xs"><?= $withTotal ?> ج.م</span>
                <span class="text-[10px] text-slate-500"><?= $withCount ?> عمليات مؤكدة</span>
              </div>
            </div>

            <!-- Device specs summary -->
            <div class="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
              <span class="flex items-center gap-1 truncate max-w-[170px]" title="<?= $devName ?>">
                <span><?= $devType === 'desktop' ? '💻' : ($devType === 'tablet' ? '📟' : '📱') ?></span>
                <span class="truncate"><?= $devName ?></span>
              </span>
              <span class="text-[10px] text-slate-500">آخر دخول: <?= $lastSeen ?></span>
            </div>

            <!-- Card Action Footer -->
            <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80" onclick="event.stopPropagation()">
              <button 
                type="button"
                onclick="openPlayerProfileModal('<?= $rawUid ?>')" 
                class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-xs transition shadow-md shadow-blue-900/40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>👤</span>
                <span>فتح البروفايل والتحكم</span>
              </button>

              <button 
                type="button"
                onclick="openSupportChatForUser('<?= $rawUid ?>')" 
                class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 cursor-pointer"
                title="محادثة دعم فني مباشرة مع اللاعب"
              >
                💬
              </button>

              <?php if ($isUserBanned): ?>
                <button 
                  type="button"
                  onclick="quickToggleBan('<?= $rawUid ?>', false)" 
                  class="px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 transition cursor-pointer"
                  title="فك الحظر عن اللاعب"
                >
                  فك الحظر
                </button>
              <?php else: ?>
                <button 
                  type="button"
                  onclick="openDeleteModal('<?= $uid ?>', '<?= addslashes($uname) ?>', '<?= addslashes($uphone) ?>', '<?= addslashes($devId) ?>', '<?= addslashes($devName) ?>')" 
                  class="px-3 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-xs font-bold border border-red-500/30 transition cursor-pointer"
                  title="حظر المستخدم والجهاز نهائياً"
                >
                  حظر 🚫
                </button>
              <?php endif; ?>
            </div>
          </div>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>

      <!-- ============================================== -->
      <!-- VIEW 2: DETAILED TABLE VIEW (الجدول التفصيلي) -->
      <!-- ============================================== -->
      <div id="users-table-view" class="hidden bg-[#10192e] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-right text-xs" id="devices-table">
            <thead class="bg-[#0b1222] text-slate-400 font-bold border-b border-slate-800 select-none">
              <tr>
                <th class="p-3.5">اللاعب والـ ID</th>
                <th class="p-3.5 text-center">حالة الاتصال</th>
                <th class="p-3.5">رقم الهاتف</th>
                <th class="p-3.5">📱 اسم ونوع الجهاز</th>
                <th class="p-3.5">🌐 المتصفح ونظام التشغيل</th>
                <th class="p-3.5">🆔 بصمة الجهاز (Device ID)</th>
                <th class="p-3.5">الرصيد الحالي</th>
                <th class="p-3.5">آخر نشاط / دخول</th>
                <th class="p-3.5 text-center">الإجراء والتحكم</th>
              </tr>
            </thead>
            <tbody id="devices-table-body" class="divide-y divide-slate-800/60 font-medium">
              <?php if (empty($usersList)): ?>
                <tr>
                  <td colspan="9" class="p-8 text-center text-slate-500">لا يوجد مستخدمون مسجلون حالياً في قاعدة البيانات</td>
                </tr>
              <?php else: ?>
                <?php foreach ($usersList as $u): 
                  $uid = htmlspecialchars($u['id'] ?? '');
                  $rawUid = $u['id'] ?? '';
                  $uname = htmlspecialchars($u['username'] ?? 'لاعب');
                  $uphone = htmlspecialchars($u['phone'] ?? '');
                  $ubal = number_format(floatval($u['balance'] ?? 0), 2);
                  $devName = htmlspecialchars($u['deviceName'] ?? 'هاتف محمول / كمبيوتر');
                  $devType = htmlspecialchars($u['deviceType'] ?? 'mobile');
                  $devOS = htmlspecialchars($u['deviceOS'] ?? 'غير محدد');
                  $devBrowser = htmlspecialchars($u['deviceBrowser'] ?? 'متصفح ويب');
                  $devId = htmlspecialchars($u['deviceId'] ?? 'DEV-N/A');
                  $lastSeen = safe_date($u['lastSeen'] ?? null);
                  $isUserBanned = !empty($u['isBanned']) || isset($bannedUsers[$uid]) || isset($bannedDevices[$devId]);
                  $isCurrentlyOnline = !empty($u['isCurrentlyOnline']);
                ?>
                <tr class="hover:bg-slate-800/40 transition device-row <?= $isUserBanned ? 'opacity-40 bg-red-950/10' : '' ?>" 
                    data-online="<?= $isCurrentlyOnline ? 'true' : 'false' ?>" 
                    data-search="<?= strtolower("{$uname} {$uid} {$uphone} {$devName} {$devId}") ?>">
                  <!-- User Info -->
                  <td class="p-3.5">
                    <div class="flex items-center gap-2 cursor-pointer" onclick="openPlayerProfileModal('<?= $rawUid ?>')">
                      <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                        <?= safe_first_char($uname) ?>
                      </div>
                      <div class="flex flex-col">
                        <span class="font-bold text-white hover:text-blue-400 transition"><?= $uname ?></span>
                        <span class="text-[10px] font-mono text-amber-400 font-bold">ID: <?= $uid ?></span>
                      </div>
                    </div>
                  </td>

                  <!-- Online Status Badge -->
                  <td class="p-3.5 text-center user-status-cell">
                    <?php if ($isCurrentlyOnline): ?>
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>متصل الآن</span>
                      </span>
                    <?php else: ?>
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-800 border border-slate-700">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                        <span>غير متصل</span>
                      </span>
                    <?php endif; ?>
                  </td>

                  <!-- Phone -->
                  <td class="p-3.5 font-mono text-slate-300">
                    <span class="bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-700/60 font-semibold"><?= $uphone ?: 'غير مسجل' ?></span>
                  </td>

                  <!-- Device Name -->
                  <td class="p-3.5">
                    <div class="flex items-center gap-2">
                      <span class="text-base">
                        <?= $devType === 'desktop' ? '💻' : ($devType === 'tablet' ? '📟' : '📱') ?>
                      </span>
                      <div class="flex flex-col">
                        <span class="font-bold text-cyan-300"><?= $devName ?></span>
                        <span class="text-[10px] text-slate-400"><?= $devType === 'desktop' ? 'كمبيوتر مكتبي' : ($devType === 'tablet' ? 'جهاز لوحي' : 'هاتف ذكي') ?></span>
                      </div>
                    </div>
                  </td>

                  <!-- OS & Browser -->
                  <td class="p-3.5">
                    <div class="flex flex-col">
                      <span class="text-slate-200"><?= $devOS ?></span>
                      <span class="text-[10px] text-slate-400 font-mono"><?= $devBrowser ?></span>
                    </div>
                  </td>

                  <!-- Device ID -->
                  <td class="p-3.5 font-mono">
                    <span class="bg-[#0b101d] text-amber-300/90 text-[10px] px-2 py-1 rounded border border-slate-800 font-mono" title="<?= $devId ?>">
                      <?= strlen($devId) > 16 ? substr($devId, 0, 16) . '...' : $devId ?>
                    </span>
                  </td>

                  <!-- Balance -->
                  <td class="p-3.5">
                    <span class="font-black text-emerald-400 font-mono"><?= $ubal ?> ج.م</span>
                  </td>

                  <!-- Last Seen -->
                  <td class="p-3.5 text-slate-400 text-[11px] font-mono">
                    <?= $lastSeen ?>
                  </td>

                  <!-- Actions: Profile & Delete & Ban -->
                  <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-1.5 flex-wrap">
                      <button 
                        type="button" 
                        onclick="openPlayerProfileModal('<?= $rawUid ?>')" 
                        class="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-900/30 transition cursor-pointer flex items-center gap-1"
                        title="فتح البروفايل الشامل والتحكم الكامل"
                      >
                        <span>👤</span>
                        <span>البروفايل</span>
                      </button>

                      <?php if ($isUserBanned): ?>
                        <button 
                          type="button" 
                          onclick="quickToggleBan('<?= $rawUid ?>', false)"
                          class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 transition cursor-pointer"
                        >
                          فك الحظر
                        </button>
                      <?php else: ?>
                        <button 
                          type="button" 
                          onclick="openDeleteModal('<?= $uid ?>', '<?= addslashes($uname) ?>', '<?= addslashes($uphone) ?>', '<?= addslashes($devId) ?>', '<?= addslashes($devName) ?>')"
                          class="px-2 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1"
                          title="حذف وحظر الجهاز"
                        >
                          <span>🚫</span>
                        </button>
                      <?php endif; ?>
                    </div>
                  </td>
                </tr>
                <?php endforeach; ?>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ======================================================== -->
    <!-- TAB 2: BANNED USERS & BLOCKED DEVICES (المحظورين) -->
    <!-- ======================================================== -->
    <section id="tab-content-banned" class="tab-content hidden flex flex-col gap-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex flex-col">
          <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <span>🚫</span>
            <span>قائمة المستخدمين والأجهزة المحظورة نهائياً من دخول المنصة</span>
          </h2>
          <p class="text-xs text-slate-400">كل مستخدم تم حذفه يتم حظر رقم هاتفه ومعرف جهازه هنا لمنعه من التسجيل أو الدخول مرة أخرى.</p>
        </div>
      </div>

      <div class="bg-[#10192e] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-right text-xs">
            <thead class="bg-[#0b1222] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th class="p-3.5">معرف اللاعب / الحظر</th>
                <th class="p-3.5">اسم اللاعب</th>
                <th class="p-3.5">رقم الهاتف المحظور</th>
                <th class="p-3.5">معرف الجهاز المحظور</th>
                <th class="p-3.5">وقت الحظر</th>
                <th class="p-3.5">سبب الحظر</th>
                <th class="p-3.5 text-center">إلغاء الحظر</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-medium">
              <?php 
              $allBans = array_merge($bannedUsers, $bannedDevices);
              if (empty($allBans)): 
              ?>
                <tr>
                  <td colspan="7" class="p-8 text-center text-slate-500">لا يوجد أي مستخدمين أو أجهزة محظورة حالياً ✅</td>
                </tr>
              <?php else: ?>
                <?php foreach ($allBans as $bKey => $b): 
                  $bUserId = htmlspecialchars($b['userId'] ?? $bKey);
                  $bUser = htmlspecialchars($b['username'] ?? 'مستخدم محظور');
                  $bPhone = htmlspecialchars($b['phone'] ?? 'N/A');
                  $bDev = htmlspecialchars($b['deviceId'] ?? $bKey);
                  $bDate = safe_date($b['bannedAt'] ?? null);
                  $bReason = htmlspecialchars($b['reason'] ?? 'تم الحظر بواسطة الإدارة');
                ?>
                <tr class="hover:bg-slate-800/40 transition">
                  <td class="p-3.5 font-mono text-amber-400 font-bold"><?= $bUserId ?></td>
                  <td class="p-3.5 font-bold text-white"><?= $bUser ?></td>
                  <td class="p-3.5 font-mono text-slate-300"><?= $bPhone ?></td>
                  <td class="p-3.5 font-mono text-xs text-red-400"><?= $bDev ?></td>
                  <td class="p-3.5 font-mono text-slate-400"><?= $bDate ?></td>
                  <td class="p-3.5 text-slate-300"><?= $bReason ?></td>
                  <td class="p-3.5 text-center">
                    <button 
                      type="button" 
                      onclick="unbanIdentifier('<?= $bKey ?>')" 
                      class="px-3 py-1 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      فك الحظر ✅
                    </button>
                  </td>
                </tr>
                <?php endforeach; ?>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ======================================================== -->
    <!-- TAB 3: DEPOSITS (طلبات الإيداع) -->
    <!-- ======================================================== -->
    <section id="tab-content-deposits" class="tab-content hidden flex flex-col gap-5">
      <!-- Section Header -->
      <div class="flex items-center justify-between flex-wrap gap-3 bg-[#10192e] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-2xl shadow-inner">
            📥
          </div>
          <div class="flex flex-col">
            <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>طلبات شحن وإيداع الرصيد الواردة من اللاعبين</span>
              <span class="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold" id="deposits-count-badge"><?= count($depositsList) ?> طلب</span>
            </h2>
            <span class="text-xs text-slate-400">راجع رقم المحفظة المحول منها، كود التحويل، وصورة الإيصال ثم وافق لشحن الحساب فوراً.</span>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Clear Deposits Button -->
          <button 
            onclick="clearAllTransactionsPrompt('deposit')" 
            class="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="تصفير ومسح جميع طلبات الإيداع الحالية"
          >
            <span>🗑️</span>
            <span>مسح وتصفير طلبات الإيداع</span>
          </button>
        </div>
      </div>

      <!-- Controls Bar: Filter Pills, Search Bar, and View Mode Toggle -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <!-- Status Filter Pills -->
        <div class="flex items-center gap-2 flex-wrap">
          <button 
            onclick="filterDepositsByStatus('all')" 
            id="dep-filter-all" 
            class="dep-filter-btn px-3.5 py-1.5 rounded-xl font-bold text-xs transition bg-blue-600 text-white shadow-md shadow-blue-600/30 cursor-pointer flex items-center gap-1.5"
          >
            <span>📋 الكل</span>
            <span class="bg-blue-900/60 text-white px-1.5 py-0.5 rounded-md text-[10px] font-mono"><?= count($depositsList) ?></span>
          </button>

          <button 
            onclick="filterDepositsByStatus('pending')" 
            id="dep-filter-pending" 
            class="dep-filter-btn px-3.5 py-1.5 rounded-xl font-bold text-xs transition bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer flex items-center gap-1.5"
          >
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>⏳ قيد المراجعة</span>
            <span class="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold"><?= $pendingDepositsCount ?></span>
          </button>

          <button 
            onclick="filterDepositsByStatus('completed')" 
            id="dep-filter-completed" 
            class="dep-filter-btn px-3.5 py-1.5 rounded-xl font-bold text-xs transition bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer flex items-center gap-1.5"
          >
            <span>✅ المقبولة</span>
            <span class="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold"><?= $completedDepositsCount ?></span>
          </button>

          <button 
            onclick="filterDepositsByStatus('rejected')" 
            id="dep-filter-rejected" 
            class="dep-filter-btn px-3.5 py-1.5 rounded-xl font-bold text-xs transition bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer flex items-center gap-1.5"
          >
            <span>❌ المرفوضة</span>
            <span class="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold"><?= $rejectedDepositsCount ?></span>
          </button>
        </div>

        <!-- Search input and View Mode Switcher -->
        <div class="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div class="relative min-w-[240px] sm:min-w-[280px]">
            <input 
              type="text" 
              id="deposits-search-input" 
              oninput="filterDepositsLive()" 
              placeholder="🔍 بحث باسم اللاعب، الـ ID، المحفظة، كود التحويل..." 
              class="w-full bg-[#0d1527] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            >
          </div>

          <!-- View Mode Toggle Buttons -->
          <div class="flex items-center bg-[#0d1527] border border-slate-700 rounded-xl p-0.5">
            <button 
              id="dep-view-cards-btn" 
              onclick="setDepositsViewMode('cards')" 
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition bg-blue-600 text-white shadow-sm flex items-center gap-1 cursor-pointer"
              title="عرض البطاقات المميزة"
            >
              <span>🎴</span>
              <span class="hidden sm:inline">بطاقات</span>
            </button>
            <button 
              id="dep-view-table-btn" 
              onclick="setDepositsViewMode('table')" 
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              title="عرض الجدول المعتاد"
            >
              <span>📑</span>
              <span class="hidden sm:inline">جدول</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- VIEW 1: MODERN CARDS GRID (التصميم الجديد المميز) -->
      <!-- ======================================================== -->
      <div id="deposits-cards-view" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <?php if (empty($depositsList)): ?>
          <div class="col-span-full py-16 text-center bg-[#10192e] rounded-3xl border border-slate-800 flex flex-col items-center justify-center gap-3">
            <span class="text-4xl">📥</span>
            <span class="text-sm font-bold text-slate-400">لا توجد أي طلبات إيداع واردة حالياً</span>
            <span class="text-xs text-slate-500">ستظهر طلبات شحن الرصيد الجديدة تلقائياً هنا فور قيام اللاعبين بالإيداع.</span>
          </div>
        <?php else: ?>
          <?php foreach ($depositsList as $d): 
            $txId = htmlspecialchars($d['id'] ?? '');
            $txUser = htmlspecialchars($d['userName'] ?? 'لاعب');
            $txUid = htmlspecialchars($d['userId'] ?? '');
            $txAmt = number_format(floatval($d['amount'] ?? 0), 2);
            $txMethod = htmlspecialchars($d['method'] ?? 'فودافون كاش');
            $txSender = htmlspecialchars($d['senderPhone'] ?? $d['userPhone'] ?? '');
            $txRef = htmlspecialchars($d['referenceCode'] ?? $d['refCode'] ?? '');
            $txReceipt = htmlspecialchars($d['receiptImage'] ?? '');
            $txStatus = htmlspecialchars($d['status'] ?? 'pending');
            $txDate = safe_date($d['timestamp'] ?? null);
            $txAgo = safe_time_ago($d['timestamp'] ?? null);
            $txNote = htmlspecialchars($d['note'] ?? '');

            // Method theme styles
            $methodBadgeBg = 'bg-red-500/20 text-red-400 border-red-500/30';
            $methodIcon = '🔴';
            if (stripos($txMethod, 'إنستاباي') !== false || stripos($txMethod, 'instapay') !== false) {
              $methodBadgeBg = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
              $methodIcon = '⚡';
            } elseif (stripos($txMethod, 'اتصالات') !== false || stripos($txMethod, 'etisalat') !== false) {
              $methodBadgeBg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
              $methodIcon = '🟢';
            } elseif (stripos($txMethod, 'أورنج') !== false || stripos($txMethod, 'orange') !== false) {
              $methodBadgeBg = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
              $methodIcon = '🟠';
            }

            // Card highlight border by status
            $cardBorder = 'border-slate-800 hover:border-slate-700';
            if ($txStatus === 'pending') {
              $cardBorder = 'border-amber-500/40 bg-gradient-to-b from-[#131d35] via-[#0f172a] to-[#0a101f] shadow-lg shadow-amber-950/20';
            } elseif ($txStatus === 'completed') {
              $cardBorder = 'border-emerald-500/30 bg-[#0c1424]';
            } elseif ($txStatus === 'rejected') {
              $cardBorder = 'border-red-500/30 bg-[#140e19] opacity-80';
            }
            
            $searchData = strtolower("{$txId} {$txUser} {$txUid} {$txSender} {$txRef} {$txMethod} {$txAmt}");
          ?>
          <div 
            class="deposit-card relative rounded-3xl border p-5 flex flex-col justify-between gap-4 transition-all duration-300 <?= $cardBorder ?>"
            data-status="<?= $txStatus ?>"
            data-search="<?= $searchData ?>"
            data-txid="<?= $txId ?>"
          >
            <!-- Card Header: Payment Method & Status Badge -->
            <div class="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-xl text-xs font-bold border <?= $methodBadgeBg ?> flex items-center gap-1 shadow-sm">
                  <span><?= $methodIcon ?></span>
                  <span><?= $txMethod ?></span>
                </span>
                <span class="text-[10px] text-slate-400 font-mono" title="<?= $txDate ?>">🕒 <?= $txAgo ?></span>
              </div>

              <!-- Status Pill -->
              <div>
                <?php if ($txStatus === 'pending'): ?>
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse shadow-sm">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>قيد المراجعة ⏳</span>
                  </span>
                <?php elseif ($txStatus === 'completed'): ?>
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <span>مقبول ومكتمل ✅</span>
                  </span>
                <?php else: ?>
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                    <span>مرفوض ❌</span>
                  </span>
                <?php endif; ?>
              </div>
            </div>

            <!-- Player & Amount Block -->
            <div class="flex items-start justify-between gap-3">
              <!-- Player Profile Info -->
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base flex items-center justify-center shadow-md">
                  <?= safe_first_char($txUser) ?>
                </div>
                <div class="flex flex-col">
                  <span class="font-black text-white text-sm leading-snug"><?= $txUser ?></span>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <button 
                      onclick="copyToClipboard('<?= $txUid ?>', 'تم نسخ معرف اللاعب')" 
                      class="text-[10px] font-mono text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-800/60 px-1.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                      title="انقر لنسخ المعرف"
                    >
                      <span>ID: #<?= $txUid ?></span>
                      <span>📋</span>
                    </button>
                    <?php if (!empty($d['userPhone'])): ?>
                      <span class="text-[10px] text-slate-400 font-mono"><?= htmlspecialchars($d['userPhone']) ?></span>
                    <?php endif; ?>
                  </div>
                </div>
              </div>

              <!-- Deposit Amount -->
              <div class="flex flex-col items-end">
                <span class="text-[10px] text-slate-400 font-medium">المبلغ المطلوب</span>
                <span class="text-xl sm:text-2xl font-black text-emerald-400 font-mono leading-none mt-0.5">
                  <?= $txAmt ?> <span class="text-xs text-emerald-500 font-normal">ج.م</span>
                </span>
              </div>
            </div>

            <!-- Transfer Details Grid (Sender Phone & Reference Code) -->
            <div class="bg-[#0b1220] rounded-2xl border border-slate-800/90 p-3 flex flex-col gap-2 text-xs">
              <!-- Sender Phone -->
              <div class="flex items-center justify-between">
                <span class="text-slate-400 flex items-center gap-1">
                  <span>📱</span>
                  <span>رقم المحفظة المحول منها:</span>
                </span>
                <div class="flex items-center gap-1.5">
                  <span class="font-mono font-bold text-cyan-300 text-sm"><?= $txSender ?: 'غير محدد' ?></span>
                  <?php if ($txSender): ?>
                    <button 
                      onclick="copyToClipboard('<?= $txSender ?>', 'تم نسخ رقم المحفظة')" 
                      class="text-slate-400 hover:text-white text-xs cursor-pointer p-0.5"
                      title="نسخ الرقم"
                    >
                      📋
                    </button>
                  <?php endif; ?>
                </div>
              </div>

              <!-- Transfer Reference Code -->
              <div class="flex items-center justify-between border-t border-slate-800/60 pt-2">
                <span class="text-slate-400 flex items-center gap-1">
                  <span>🔖</span>
                  <span>رقم / كود التحويل البنكي:</span>
                </span>
                <div class="flex items-center gap-1.5">
                  <?php if ($txRef): ?>
                    <span class="font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-700/60 px-2 py-0.5 rounded-lg text-xs">
                      <?= $txRef ?>
                    </span>
                    <button 
                      onclick="copyToClipboard('<?= $txRef ?>', 'تم نسخ كود التحويل')" 
                      class="text-slate-400 hover:text-white text-xs cursor-pointer p-0.5"
                      title="نسخ كود التحويل"
                    >
                      📋
                    </button>
                  <?php else: ?>
                    <span class="text-slate-500 text-[11px] italic">غير مدخل (مرفق إيصال فقط)</span>
                  <?php endif; ?>
                </div>
              </div>

              <!-- Rejection Reason or Note if present -->
              <?php if ($txNote): ?>
                <div class="border-t border-slate-800/60 pt-2 text-[11px] text-amber-300/90 flex items-start gap-1">
                  <span>💬</span>
                  <span><strong>ملاحظة:</strong> <?= $txNote ?></span>
                </div>
              <?php endif; ?>
            </div>

            <!-- Receipt Screenshot Preview -->
            <div class="relative">
              <?php if ($txReceipt): ?>
                <div class="group relative rounded-2xl overflow-hidden border border-slate-700 bg-black/60 aspect-[16/9] flex items-center justify-center cursor-pointer" onclick="openReceiptLightbox('<?= $txReceipt ?>', '<?= $txUser ?>', '<?= $txUid ?>', '<?= $txAmt ?>', '<?= $txSender ?>', '<?= $txRef ?>', '<?= $txId ?>', '<?= $txStatus ?>')">
                  <img 
                    src="<?= $txReceipt ?>" 
                    alt="إيصال التحويل" 
                    class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  >
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <span class="bg-blue-600/90 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
                      <span>🔍</span>
                      <span>تكبير وفحص الإيصال</span>
                    </span>
                  </div>
                  <div class="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] text-slate-300 font-mono font-bold flex items-center gap-1">
                    <span>📸</span>
                    <span>إيصال التحويل البنكي</span>
                  </div>
                </div>
              <?php else: ?>
                <div class="rounded-2xl border border-dashed border-slate-800 bg-[#0a0f1d] p-3 text-center flex items-center justify-center gap-2 text-slate-500 text-xs">
                  <span>⚠️</span>
                  <span>لم يرفق اللاعب صورة إيصال (تم الاعتماد على رقم المحفظة وكود التحويل)</span>
                </div>
              <?php endif; ?>
            </div>

            <!-- Transaction Actions Footer -->
            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-1">
                <?php if ($txStatus === 'pending'): ?>
                  <!-- Approve Button -->
                  <button 
                    onclick="approveDeposit('<?= $txId ?>')" 
                    class="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-900/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>موافقة وشحن الرصيد</span>
                    <span>✅</span>
                  </button>

                  <!-- Reject Button (Modal with reasons) -->
                  <button 
                    onclick="openRejectDepositModal('<?= $txId ?>', '<?= $txUser ?>', '<?= $txAmt ?>')" 
                    class="py-2.5 px-3 rounded-xl bg-red-600/80 hover:bg-red-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <span>رفض</span>
                    <span>❌</span>
                  </button>
                <?php elseif ($txStatus === 'completed'): ?>
                  <div class="flex-1 py-2 px-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                    <span>تم شحن الرصيد بنجاح</span>
                    <span>✅</span>
                  </div>
                <?php else: ?>
                  <div class="flex-1 py-2 px-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5">
                    <span>تم رفض الطلب</span>
                    <span>❌</span>
                  </div>
                <?php endif; ?>
              </div>

              <!-- Delete single button -->
              <button 
                onclick="deleteTx('<?= $txId ?>')" 
                class="p-2.5 rounded-xl bg-slate-800 hover:bg-red-700 text-slate-400 hover:text-white font-bold text-xs transition border border-slate-700 cursor-pointer" 
                title="مسح هذا الطلب نهائياً من القائمة"
              >
                🗑️
              </button>
            </div>

          </div>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>

      <!-- ======================================================== -->
      <!-- VIEW 2: DENSE TABLE (الجدول المعتاد) -->
      <!-- ======================================================== -->
      <div id="deposits-table-view" class="hidden bg-[#10192e] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-right text-xs">
            <thead class="bg-[#0b1222] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th class="p-3.5">كود المعاملة</th>
                <th class="p-3.5">اللاعب والـ ID</th>
                <th class="p-3.5">المبلغ المطلوب</th>
                <th class="p-3.5">طريقة الإيداع</th>
                <th class="p-3.5">رقم المحفظة</th>
                <th class="p-3.5">كود التحويل</th>
                <th class="p-3.5">الإيصال</th>
                <th class="p-3.5">الوقت</th>
                <th class="p-3.5">الحالة</th>
                <th class="p-3.5 text-center">الإجراء والتحكم</th>
              </tr>
            </thead>
            <tbody id="deposits-table-body" class="divide-y divide-slate-800/60 font-medium">
              <?php if (empty($depositsList)): ?>
                <tr>
                  <td colspan="10" class="p-8 text-center text-slate-500">لا توجد أي طلبات إيداع حالياً</td>
                </tr>
              <?php else: ?>
                <?php foreach ($depositsList as $d): 
                  $txId = htmlspecialchars($d['id'] ?? '');
                  $txUser = htmlspecialchars($d['userName'] ?? 'لاعب');
                  $txUid = htmlspecialchars($d['userId'] ?? '');
                  $txAmt = number_format(floatval($d['amount'] ?? 0), 2);
                  $txMethod = htmlspecialchars($d['method'] ?? 'فودافون كاش');
                  $txSender = htmlspecialchars($d['senderPhone'] ?? $d['userPhone'] ?? '');
                  $txRef = htmlspecialchars($d['referenceCode'] ?? $d['refCode'] ?? '');
                  $txReceipt = htmlspecialchars($d['receiptImage'] ?? '');
                  $txStatus = htmlspecialchars($d['status'] ?? 'pending');
                  $txDate = safe_date($d['timestamp'] ?? null);
                  $txAgo = safe_time_ago($d['timestamp'] ?? null);
                  $searchData = strtolower("{$txId} {$txUser} {$txUid} {$txSender} {$txRef} {$txMethod} {$txAmt}");
                ?>
                <tr class="deposit-table-row hover:bg-slate-800/40 transition" data-status="<?= $txStatus ?>" data-search="<?= $searchData ?>" data-txid="<?= $txId ?>">
                  <td class="p-3.5 font-mono text-slate-300 font-bold"><?= $txId ?></td>
                  <td class="p-3.5">
                    <span class="font-bold text-white"><?= $txUser ?></span>
                    <span class="text-[10px] text-amber-400 font-mono block">ID: <?= $txUid ?></span>
                  </td>
                  <td class="p-3.5 font-mono font-black text-emerald-400 text-sm"><?= $txAmt ?> ج.م</td>
                  <td class="p-3.5 text-slate-300"><?= $txMethod ?></td>
                  <td class="p-3.5 font-mono text-cyan-300 font-bold"><?= $txSender ?: 'غير محدد' ?></td>
                  <td class="p-3.5 font-mono text-amber-300 font-bold"><?= $txRef ?: '<span class="text-slate-600 font-normal">--</span>' ?></td>
                  <td class="p-3.5">
                    <?php if ($txReceipt): ?>
                      <button onclick="openReceiptLightbox('<?= $txReceipt ?>', '<?= $txUser ?>', '<?= $txUid ?>', '<?= $txAmt ?>', '<?= $txSender ?>', '<?= $txRef ?>', '<?= $txId ?>', '<?= $txStatus ?>')" class="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold hover:bg-blue-500 hover:text-white transition cursor-pointer">
                        🔍 فحص الإيصال
                      </button>
                    <?php else: ?>
                      <span class="text-slate-500 text-[11px]">بدون صورة</span>
                    <?php endif; ?>
                  </td>
                  <td class="p-3.5 text-slate-400 font-mono text-[11px]"><?= $txAgo ?></td>
                  <td class="p-3.5">
                    <?php if ($txStatus === 'completed'): ?>
                      <span class="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-500/30">مقبول</span>
                    <?php elseif ($txStatus === 'rejected'): ?>
                      <span class="bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded text-[10px] border border-red-500/30">مرفوض</span>
                    <?php else: ?>
                      <span class="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded text-[10px] border border-amber-500/30 animate-pulse">معلق</span>
                    <?php endif; ?>
                  </td>
                  <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-1.5 flex-wrap">
                      <?php if ($txStatus === 'pending'): ?>
                        <button onclick="approveDeposit('<?= $txId ?>')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer">
                          موافقة ✅
                        </button>
                        <button onclick="openRejectDepositModal('<?= $txId ?>', '<?= $txUser ?>', '<?= $txAmt ?>')" class="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition cursor-pointer">
                          رفض ❌
                        </button>
                      <?php else: ?>
                        <span class="text-slate-500 text-[11px]">معالج</span>
                      <?php endif; ?>
                      <button 
                        onclick="deleteTx('<?= $txId ?>')" 
                        class="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-red-700 text-slate-400 hover:text-white font-bold text-xs transition border border-slate-700 cursor-pointer" 
                        title="مسح هذا الطلب نهائياً"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
                <?php endforeach; ?>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ======================================================== -->
    <!-- TAB 4: WITHDRAWALS (طلبات سحب الأرباح) -->
    <!-- ======================================================== -->
    <section id="tab-content-withdraws" class="tab-content hidden flex flex-col gap-4">
      
      <!-- Withdrawals Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xl shadow-inner">
            📤
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>طلبات سحب الأرباح من محافظ اللاعبين</span>
              <span class="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/40 px-2 py-0.5 rounded-full font-mono font-bold" id="withdraws-count-badge"><?= $totalWithdraws ?> طلبات</span>
            </h2>
            <p class="text-xs text-slate-400">راجع رقم محفظة اللاعب المطلوب تحويل أرباحه إليها، اضغط نسخ الرقم للتحويل، ثم أكد العملية.</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            type="button" 
            onclick="clearAllTransactionsPrompt('withdraw')" 
            class="px-3.5 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/80 border border-red-800/80 text-red-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="تصفير ومسح جميع طلبات السحب الحالية"
          >
            <span>🗑️</span>
            <span>مسح وتصفير طلبات السحب (<?= $totalWithdraws ?>)</span>
          </button>
        </div>
      </div>

      <!-- Withdrawals Toolbar: Search, Status Filter Pills & View Mode Switcher -->
      <div class="bg-[#10192e] border border-slate-800/90 rounded-2xl p-3.5 flex flex-col lg:flex-row items-center justify-between gap-3 shadow-xl">
        
        <!-- Live Search Field -->
        <div class="relative w-full lg:w-80">
          <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-sm">
            🔍
          </span>
          <input 
            type="text" 
            id="withdraws-search-input" 
            oninput="filterWithdrawsLive()" 
            placeholder="بحث باسم اللاعب، ID، رقم المحفظة، أو كود العملية..." 
            class="w-full bg-[#0b101d] border border-slate-700/80 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          >
        </div>

        <!-- Status Filter Pills -->
        <div class="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 custom-scrollbar">
          <button 
            type="button" 
            id="with-filter-all" 
            onclick="filterWithdrawsByStatus('all')" 
            class="with-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-purple-600 text-white border border-purple-500 shadow"
          >
            <span>الكل</span>
            <span class="bg-black/30 px-1.5 py-0.2 rounded-md text-[10px] font-mono"><?= $totalWithdraws ?></span>
          </button>

          <button 
            type="button" 
            id="with-filter-pending" 
            onclick="filterWithdrawsByStatus('pending')" 
            class="with-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-[#152037] text-slate-300 border border-slate-700/60 hover:text-white"
          >
            <span class="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            <span>معلق بانتظار التحويل</span>
            <span class="bg-purple-900/60 text-purple-300 border border-purple-700/60 px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold"><?= $pendingWithdrawsCount ?></span>
          </button>

          <button 
            type="button" 
            id="with-filter-completed" 
            onclick="filterWithdrawsByStatus('completed')" 
            class="with-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-[#152037] text-slate-300 border border-slate-700/60 hover:text-white"
          >
            <span>محول بنجاح</span>
            <span class="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.2 rounded-md text-[10px] font-mono"><?= $completedWithdrawsCount ?></span>
          </button>

          <button 
            type="button" 
            id="with-filter-rejected" 
            onclick="filterWithdrawsByStatus('rejected')" 
            class="with-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-[#152037] text-slate-300 border border-slate-700/60 hover:text-white"
          >
            <span>مرفوض ومسترجع</span>
            <span class="bg-red-950/60 text-red-400 border border-red-800/60 px-1.5 py-0.2 rounded-md text-[10px] font-mono"><?= $rejectedWithdrawsCount ?></span>
          </button>
        </div>

        <!-- View Mode Switcher (Cards vs Table) -->
        <div class="flex items-center gap-1 bg-[#0b101d] p-1 rounded-xl border border-slate-800 shrink-0">
          <button 
            type="button" 
            id="with-view-cards-btn" 
            onclick="setWithdrawsViewMode('cards')" 
            class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer bg-purple-600 text-white shadow"
            title="عرض كبطاقات حديثة"
          >
            <span>🗂️</span>
            <span class="hidden sm:inline">بطاقات</span>
          </button>
          <button 
            type="button" 
            id="with-view-table-btn" 
            onclick="setWithdrawsViewMode('table')" 
            class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer bg-[#152037] text-slate-400 hover:text-white"
            title="عرض كجدول تقليدي"
          >
            <span>📑</span>
            <span class="hidden sm:inline">جدول</span>
          </button>
        </div>

      </div>

      <!-- ================= VIEW 1: MODERN CARD-BASED GRID ================= -->
      <div id="withdraws-grid-view" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <?php if (empty($withdrawsList)): ?>
          <div class="col-span-full bg-[#10192e] border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
            <span class="text-4xl">📭</span>
            <h3 class="text-base font-bold text-slate-300">لا توجد طلبات سحب حالياً</h3>
            <p class="text-xs text-slate-500 max-w-md">عندما يطلب أي لاعب سحب أرباحه، ستظهر بطاقة كاملة هنا تحتوي على بيانات المحفظة وزر التحويل الفوري.</p>
          </div>
        <?php else: ?>
          <?php foreach ($withdrawsList as $w): 
            $wId = htmlspecialchars($w['id'] ?? '');
            $wUser = htmlspecialchars($w['userName'] ?? 'لاعب');
            $wUid = htmlspecialchars($w['userId'] ?? '');
            $wAmt = number_format(floatval($w['amount'] ?? 0), 2);
            $wPhone = htmlspecialchars($w['senderPhone'] ?? $w['phone'] ?? $w['userPhone'] ?? '');
            $wMethod = htmlspecialchars($w['method'] ?? $w['paymentMethod'] ?? 'المحفظة الإلكترونية');
            $wStatus = htmlspecialchars($w['status'] ?? 'pending');
            $wTime = safe_time_ago($w['createdAt'] ?? $w['timestamp'] ?? null);
            $wRejectReason = htmlspecialchars($w['rejectReason'] ?? $w['reason'] ?? '');
            $searchData = strtolower("{$wId} {$wUser} {$wUid} {$wPhone} {$wMethod} {$wAmt}");
          ?>
          <div 
            class="withdraw-card bg-[#10192e] border border-slate-800 hover:border-slate-700 rounded-3xl p-4 flex flex-col justify-between gap-3 shadow-xl transition-all duration-200"
            data-txid="<?= $wId ?>"
            data-status="<?= $wStatus ?>"
            data-search="<?= $searchData ?>"
          >
            <!-- Card Header: User info & Time -->
            <div class="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-800 to-indigo-700 text-white font-black text-sm flex items-center justify-center shadow-md">
                  <?= safe_first_char($wUser) ?>
                </div>
                <div class="flex flex-col">
                  <span class="font-bold text-white text-xs leading-tight"><?= $wUser ?></span>
                  <div class="flex items-center gap-1 mt-0.5">
                    <span class="text-[10px] font-mono text-amber-400 font-bold bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.2 rounded">ID: <?= $wUid ?></span>
                    <button 
                      type="button" 
                      onclick="copyToClipboard('<?= $wUid ?>', 'تم نسخ الـ ID')" 
                      class="text-slate-400 hover:text-white text-[10px] cursor-pointer" 
                      title="نسخ معرف اللاعب"
                    >
                      📋
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex flex-col items-end">
                <span class="text-[10px] text-slate-400 font-mono"><?= $wTime ?></span>
                <span class="text-[9px] font-mono text-slate-500">#<?= substr($wId, 0, 10) ?></span>
              </div>
            </div>

            <!-- Card Body: Amount & Recipient Wallet Number -->
            <div class="bg-[#0b101d] rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2.5">
              
              <!-- Amount Row -->
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-slate-400 font-bold">المبلغ المطلوب سحبه:</span>
                <div class="flex items-baseline gap-1">
                  <span class="text-lg font-black text-purple-400 font-mono"><?= $wAmt ?></span>
                  <span class="text-xs text-purple-300 font-bold">ج.م</span>
                </div>
              </div>

              <!-- Recipient Wallet Phone Number with One-Click Copy -->
              <div class="flex items-center justify-between bg-[#152037] px-2.5 py-2 rounded-xl border border-slate-700/60">
                <div class="flex flex-col">
                  <span class="text-[10px] text-slate-400">رقم المحفظة المستلمة:</span>
                  <span class="text-xs font-mono font-bold text-amber-300 tracking-wider"><?= $wPhone ?: 'غير محدد' ?></span>
                </div>
                <?php if ($wPhone): ?>
                  <button 
                    type="button" 
                    onclick="copyToClipboard('<?= $wPhone ?>', 'تم نسخ رقم المحفظة المستلمة ✅')" 
                    class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                    title="نسخ رقم المحفظة للتحويل"
                  >
                    <span>📋</span>
                    <span>نسخ</span>
                  </button>
                <?php endif; ?>
              </div>

              <!-- Payment Method & Transaction ID -->
              <div class="flex items-center justify-between text-[11px] pt-1">
                <span class="text-slate-400 flex items-center gap-1">
                  <span>طريقة السحب:</span>
                  <span class="text-slate-200 font-bold"><?= $wMethod ?></span>
                </span>
                <button 
                  type="button" 
                  onclick="copyToClipboard('<?= $wId ?>', 'تم نسخ كود المعاملة')" 
                  class="text-[10px] font-mono text-slate-400 hover:text-white cursor-pointer"
                >
                  كود: <?= substr($wId, 0, 8) ?>... 📋
                </button>
              </div>

              <!-- Status Badge & Rejection info -->
              <div class="pt-1 border-t border-slate-800 flex items-center justify-between">
                <span class="text-[10px] text-slate-400">حالة الطلب:</span>
                <?php if ($wStatus === 'completed'): ?>
                  <span class="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <span>✅</span>
                    <span>تم التحويل بنجاح</span>
                  </span>
                <?php elseif ($wStatus === 'rejected'): ?>
                  <div class="flex flex-col items-end">
                    <span class="inline-flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      <span>❌</span>
                      <span>مرفوض ومسترجع</span>
                    </span>
                    <?php if ($wRejectReason): ?>
                      <span class="text-[9px] text-red-300/80 mt-0.5 max-w-[200px] truncate" title="<?= $wRejectReason ?>"><?= $wRejectReason ?></span>
                    <?php endif; ?>
                  </div>
                <?php else: ?>
                  <span class="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    <span class="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                    <span>معلق بانتظار التحويل</span>
                  </span>
                <?php endif; ?>
              </div>

            </div>

            <!-- Card Actions -->
            <div class="flex items-center gap-2 pt-1 border-t border-slate-800/60">
              <?php if ($wStatus === 'pending'): ?>
                <button 
                  type="button" 
                  onclick="approveWithdraw('<?= $wId ?>')" 
                  class="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>تم التحويل</span>
                  <span>✅</span>
                </button>
                <button 
                  type="button" 
                  onclick="rejectWithdraw('<?= $wId ?>')" 
                  class="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-950/40 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>رفض واسترجاع</span>
                  <span>❌</span>
                </button>
              <?php else: ?>
                <span class="flex-1 text-center py-2 text-xs font-bold text-slate-400 bg-slate-800/40 rounded-xl border border-slate-800">
                  <?= $wStatus === 'completed' ? 'تمت تسوية هذا السحب ✅' : 'تم الرفض وإرجاع الرصيد للاعب ↩️' ?>
                </span>
              <?php endif; ?>

              <!-- Direct WhatsApp Chat with this user -->
              <button 
                type="button" 
                onclick="selectSupportChat('<?= $wUid ?>'); switchTab('support');" 
                class="w-9 h-9 rounded-xl bg-[#202c33] hover:bg-emerald-700 text-slate-300 hover:text-white transition flex items-center justify-center text-sm border border-slate-700/80 cursor-pointer shrink-0" 
                title="فتح محادثة واتساب فورية مع هذا اللاعب"
              >
                💬
              </button>

              <!-- Delete single transaction button -->
              <button 
                type="button" 
                onclick="deleteTx('<?= $wId ?>')" 
                class="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-red-700 text-slate-400 hover:text-white transition flex items-center justify-center text-xs border border-slate-700/80 cursor-pointer shrink-0" 
                title="مسح هذا الطلب نهائياً"
              >
                🗑️
              </button>
            </div>

          </div>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>

      <!-- ================= VIEW 2: TRADITIONAL COMPACT TABLE ================= -->
      <div id="withdraws-table-view" class="bg-[#10192e] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl hidden">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-right text-xs">
            <thead class="bg-[#0b1222] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th class="p-3.5">كود المعاملة</th>
                <th class="p-3.5">اللاعب والـ ID</th>
                <th class="p-3.5">المبلغ المطلوب سحبه</th>
                <th class="p-3.5">رقم المحفظة المستلمة</th>
                <th class="p-3.5">الحالة</th>
                <th class="p-3.5 text-center">الإجراء والتحكم</th>
              </tr>
            </thead>
            <tbody id="withdraws-table-body" class="divide-y divide-slate-800/60 font-medium">
              <?php if (empty($withdrawsList)): ?>
                <tr>
                  <td colspan="6" class="p-8 text-center text-slate-500">لا توجد طلبات سحب حالياً (0 طلبات)</td>
                </tr>
              <?php else: ?>
                <?php foreach ($withdrawsList as $w): 
                  $wId = htmlspecialchars($w['id'] ?? '');
                  $wUser = htmlspecialchars($w['userName'] ?? 'لاعب');
                  $wUid = htmlspecialchars($w['userId'] ?? '');
                  $wAmt = number_format(floatval($w['amount'] ?? 0), 2);
                  $wPhone = htmlspecialchars($w['senderPhone'] ?? $w['phone'] ?? $w['userPhone'] ?? '');
                  $wStatus = htmlspecialchars($w['status'] ?? 'pending');
                  $searchData = strtolower("{$wId} {$wUser} {$wUid} {$wPhone} {$wAmt}");
                ?>
                <tr class="hover:bg-slate-800/40 transition tx-row withdraw-table-row" data-txid="<?= $wId ?>" data-status="<?= $wStatus ?>" data-search="<?= $searchData ?>">
                  <td class="p-3.5 font-mono text-slate-300 font-bold"><?= $wId ?></td>
                  <td class="p-3.5">
                    <span class="font-bold text-white"><?= $wUser ?></span>
                    <span class="text-[10px] text-amber-400 font-mono block">ID: <?= $wUid ?></span>
                  </td>
                  <td class="p-3.5 font-mono font-black text-purple-400 text-sm"><?= $wAmt ?> ج.م</td>
                  <td class="p-3.5 font-mono text-amber-300 font-bold text-sm bg-[#0a0f1d] px-2 py-1 rounded inline-block my-2">
                    <?= $wPhone ?>
                    <?php if ($wPhone): ?>
                      <button type="button" onclick="copyToClipboard('<?= $wPhone ?>')" class="text-xs text-slate-400 hover:text-white ml-1 cursor-pointer">📋</button>
                    <?php endif; ?>
                  </td>
                  <td class="p-3.5">
                    <?php if ($wStatus === 'completed'): ?>
                      <span class="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-500/30">تم التحويل بنجاح</span>
                    <?php elseif ($wStatus === 'rejected'): ?>
                      <span class="bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded text-[10px] border border-red-500/30">مرفوض ومسترجع</span>
                    <?php else: ?>
                      <span class="bg-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded text-[10px] border border-purple-500/30 animate-pulse">معلق</span>
                    <?php endif; ?>
                  </td>
                  <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-1.5 flex-wrap">
                      <?php if ($wStatus === 'pending'): ?>
                        <button onclick="approveWithdraw('<?= $wId ?>')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer">
                          تم التحويل ✅
                        </button>
                        <button onclick="rejectWithdraw('<?= $wId ?>')" class="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition cursor-pointer">
                          رفض واسترجاع ❌
                        </button>
                      <?php else: ?>
                        <span class="text-slate-500 text-[11px]">معالج</span>
                      <?php endif; ?>
                      <button 
                        onclick="deleteTx('<?= $wId ?>')" 
                        class="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-red-700 text-slate-400 hover:text-white font-bold text-xs transition border border-slate-700 cursor-pointer" 
                        title="مسح هذا الطلب نهائياً"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
                <?php endforeach; ?>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>

    </section>

    <!-- ======================================================== -->
    <!-- TAB 5: DIRECT RECHARGE (شحن مباشر) -->
    <!-- ======================================================== -->
    <section id="tab-content-recharge" class="tab-content hidden flex flex-col gap-4 max-w-xl mx-auto w-full">
      <div class="bg-[#10192e] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
          <span>💳</span>
          <span>شحن رصيد مباشر لأي لاعب بواسطة المعرف (User ID)</span>
        </h2>
        <p class="text-xs text-slate-400">يمكنك هنا إضافة رصيد فوري لحساب أي لاعب مسجل في المنصة دون الحاجة لإجراء إيداع.</p>

        <form onsubmit="handleDirectRecharge(event)" class="flex flex-col gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">معرف اللاعب (User ID):</label>
            <input type="text" id="recharge-user-id" required placeholder="مثال: 70309" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">المبلغ المطلوب إضافته (ج.م):</label>
            <input type="number" id="recharge-amount" required min="1" step="0.5" placeholder="مثال: 100" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500">
          </div>

          <button type="submit" class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition cursor-pointer mt-2">
            ⚡ إضافة وشحن الرصيد فوراً
          </button>
        </form>
      </div>
    </section>

    <!-- ======================================================== -->
    <!-- TAB 6: CRASH GAME CONTROL (التحكم بالطيارة) -->
    <!-- ======================================================== -->
    <section id="tab-content-crash" class="tab-content hidden flex flex-col gap-4 max-w-xl mx-auto w-full">
      <div class="bg-[#10192e] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
          <span>✈️</span>
          <span>التحكم بنتيجة لعبة الطيارة (Crash Game Multiplier)</span>
        </h2>
        <p class="text-xs text-slate-400">تحديد مضاعف الانفجار بدقة للجولة القادمة مباشرة في كل أجهزة اللاعبين.</p>

        <div class="flex flex-col gap-3">
          <label class="block text-xs font-bold text-slate-300">مضاعف الانفجار المطلوب:</label>
          <div class="flex items-center gap-2">
            <input type="number" id="crash-multiplier-val" placeholder="مثال: 2.50 أو اتركه فارغاً للعشوائي" step="0.01" min="1.01" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500">
            <button onclick="setCrashMultiplier()" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer whitespace-nowrap">
              تثبيت النتيجة
            </button>
          </div>
          <span class="text-[10px] text-slate-500">اترك الحقل فارغاً أو اضغط إلغاء لتكون نتائج الجولات عشوائية وطبيعية تلقائياً.</span>
        </div>
      </div>
    </section>

    <!-- ======================================================== -->
    <!-- TAB 7: SUPPORT TICKETS (نظام محادثات الدعم الفني - واتساب) -->
    <!-- ======================================================== -->
    <section id="tab-content-support" class="tab-content hidden flex flex-col gap-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl shadow-inner">
            💬
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>مركز الدعم الفني والمحادثات المباشرة (واتساب)</span>
              <span class="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold" id="support-chats-count-badge"><?= count($userChats) ?> محادثة</span>
            </h2>
            <p class="text-xs text-slate-400">لكل لاعب غرفة شات خاصة به مثل تطبيق واتساب للرد الفوري، حل المشكلات، وتأكيد الإيداعات.</p>
          </div>
        </div>
      </div>

      <!-- WhatsApp Web Layout Container -->
      <div class="bg-[#111b21] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col lg:flex-row h-[700px]">
        
        <!-- ================= LEFT SIDE: CHAT CONTACTS LIST ================= -->
        <div class="w-full lg:w-80 lg:border-l border-slate-800 flex flex-col bg-[#111b21]">
          <!-- Contacts Header -->
          <div class="bg-[#202c33] p-3.5 flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-lg">💬</span>
              <span class="text-sm font-bold text-slate-200">المحادثات والرسائل</span>
            </div>
            <span class="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-lg font-mono font-bold">
              <?= count($userChats) ?> لاعب
            </span>
          </div>

          <!-- Search input for chats -->
          <div class="p-2.5 bg-[#111b21] border-b border-slate-800">
            <div class="relative">
              <input 
                type="text" 
                id="support-chat-search" 
                oninput="filterSupportChatsList()" 
                placeholder="🔍 بحث باسم اللاعب أو الـ ID..." 
                class="w-full bg-[#202c33] border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              >
            </div>
          </div>

          <!-- Scrollable Contacts List -->
          <div id="support-contacts-list" class="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800/40">
            <?php if (empty($userChats)): ?>
              <div class="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <span class="text-3xl">📭</span>
                <span class="text-xs">لا توجد رسائل دعم فني حالياً</span>
                <span class="text-[10px] text-slate-600">أي رسالة يرسلها اللاعب من حسابه ستظهر هنا كغرفة محادثة فورية.</span>
              </div>
            <?php else: ?>
              <?php 
              $firstChatUid = null;
              foreach ($userChats as $uid => $chat): 
                if ($firstChatUid === null) $firstChatUid = $uid;
                $cName = htmlspecialchars($chat['userName'] ?? 'لاعب');
                $cPhone = htmlspecialchars($chat['userPhone'] ?? '');
                $cId = htmlspecialchars($chat['ticketId'] ?? '');
                $cBalance = number_format(floatval($chat['balance'] ?? 0), 2);
                $cOnline = !empty($chat['isOnline']);
                $cMsgs = $chat['messages'] ?? [];
                $cLast = end($cMsgs);
                $cLastText = htmlspecialchars($cLast['text'] ?? 'بدء محادثة...');
                $cLastSender = ($cLast['sender'] ?? '') === 'admin' ? 'أنت: ' : '';
                $cAgo = safe_time_ago($chat['updatedAt'] ?? null);
                $cSearch = strtolower("{$cName} {$uid} {$cPhone}");
              ?>
              <div 
                class="support-contact-item p-3 hover:bg-[#202c33]/70 cursor-pointer transition flex items-center gap-3 relative"
                data-userid="<?= $uid ?>"
                data-ticketid="<?= $cId ?>"
                data-username="<?= $cName ?>"
                data-phone="<?= $cPhone ?>"
                data-balance="<?= $cBalance ?>"
                data-online="<?= $cOnline ? '1' : '0' ?>"
                data-search="<?= $cSearch ?>"
                onclick="selectSupportChat('<?= $uid ?>')"
                id="chat-item-<?= $uid ?>"
              >
                <!-- Avatar with Online indicator -->
                <div class="relative shrink-0">
                  <div class="w-11 h-11 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 text-white font-bold text-sm flex items-center justify-center shadow-md">
                    <?= safe_first_char($cName) ?>
                  </div>
                  <?php if ($cOnline): ?>
                    <span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111b21]" title="متصل الآن"></span>
                  <?php endif; ?>
                </div>

                <!-- Chat Info Snippet -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1 mb-0.5">
                    <span class="font-bold text-slate-100 text-xs truncate"><?= $cName ?></span>
                    <span class="text-[10px] text-slate-400 font-mono shrink-0"><?= $cAgo ?></span>
                  </div>
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-[11px] text-slate-400 truncate"><?= $cLastSender ?><?= $cLastText ?></span>
                    <span class="text-[9px] font-mono text-amber-400/90 shrink-0">#<?= $uid ?></span>
                  </div>
                </div>
              </div>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
        </div>

        <!-- ================= RIGHT SIDE: WHATSAPP CHAT WINDOW ================= -->
        <div class="flex-1 flex flex-col bg-[#0b141a] relative">
          
          <!-- Chat Top Header -->
          <div id="chat-header-bar" class="bg-[#202c33] p-3 border-b border-slate-700/50 flex items-center justify-between flex-wrap gap-2 shadow-md">
            <div class="flex items-center gap-3">
              <div id="chat-header-avatar" class="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shadow">
                💬
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span id="chat-header-name" class="font-bold text-white text-sm">اختر محادثة للبدء</span>
                  <span id="chat-header-id-badge" class="text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.5 rounded"></span>
                  <span id="chat-header-online-badge" class="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold hidden">متصل الآن 🟢</span>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span id="chat-header-phone" class="text-[10px] font-mono text-slate-400"></span>
                  <span id="chat-header-balance" class="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded hidden"></span>
                </div>
              </div>
            </div>

            <!-- Quick Action Buttons for Active User -->
            <div id="chat-header-actions" class="flex items-center gap-2 hidden">
              <button 
                onclick="quickRechargeActiveChatUser()" 
                class="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-sm"
                title="الانتقال لشحن هذا اللاعب مباشرة"
              >
                <span>⚡</span>
                <span>شحن رصيد</span>
              </button>
              <button 
                onclick="filterDepositsForActiveChatUser()" 
                class="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-sm"
                title="عرض إيداعات هذا اللاعب"
              >
                <span>📥</span>
                <span>إيداعاته</span>
              </button>
            </div>
          </div>

          <!-- WhatsApp Chat Messages Scrollable Canvas -->
          <div 
            id="chat-messages-container" 
            class="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3 bg-[#0b141a]" 
            style="background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0); background-size: 24px 24px;"
          >
            <!-- Messages will be dynamically rendered here via selectSupportChat() -->
            <div class="flex-1 flex flex-col items-center justify-center text-center text-slate-500 gap-3">
              <div class="w-16 h-16 rounded-full bg-[#111b21] border border-slate-800 flex items-center justify-center text-3xl shadow-inner">
                💬
              </div>
              <span class="text-sm font-bold text-slate-400">مرحباً بك في شات الدعم الفني المباشر</span>
              <span class="text-xs text-slate-500 max-w-sm">اختر أي لاعب من القائمة على اليمين لفتح غرفة المحادثة المباشرة، الرد عليه، وإرسال رسائل فورية كواتساب تماماً.</span>
            </div>
          </div>

          <!-- WhatsApp Quick Canned Responses Bar -->
          <div id="chat-canned-responses" class="bg-[#111b21] px-3 py-2 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar hidden">
            <span class="text-[10px] text-slate-400 whitespace-nowrap font-bold flex items-center gap-1">
              <span>⚡</span>
              <span>ردود جاهزة:</span>
            </span>
            <button onclick="insertCannedResponse('تم شحن الرصيد لحسابك بنجاح يا بطل ✅')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-emerald-900/60 hover:text-emerald-300 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
              تم شحن الرصيد بنجاح ✅
            </button>
            <button onclick="insertCannedResponse('يرجى إرسال صورة واضحة لإيصال التحويل مع إظهار كود العملية 📸')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-emerald-900/60 hover:text-emerald-300 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
              أرسل صورة واضحة للإيصال 📸
            </button>
            <button onclick="insertCannedResponse('طلب السحب قيد المعالجة وسيتم تحويل المبلغ لمحفظتك خلال دقائق قليلة ⏳')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-emerald-900/60 hover:text-emerald-300 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
              طلب السحب قيد التحويل ⏳
            </button>
            <button onclick="insertCannedResponse('رقم المحفظة غير صحيح أو غير مفعل لاستلام الأموال، يرجى تزويدنا برقم صحيح ⚠️')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-red-900/60 hover:text-red-300 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
              رقم المحفظة غير صحيح ⚠️
            </button>
            <button onclick="insertCannedResponse('أهلاً بك في 1X WINNER! كيف يمكننا مساعدتك اليوم؟ 👋')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-blue-900/60 hover:text-blue-300 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
              رسالة ترحيبية 👋
            </button>
          </div>

          <!-- Chat Input Footer -->
          <div id="chat-input-toolbar" class="bg-[#202c33] p-3 border-t border-slate-800 flex items-center gap-2 hidden">
            <div class="flex-1 relative">
              <input 
                type="text" 
                id="support-chat-input" 
                placeholder="اكتب رسالتك للاعب هنا... (اضغط Enter للإرسال السريع)" 
                class="w-full bg-[#2a3942] border border-transparent focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none transition shadow-inner"
                onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendSupportChatReply(); }"
              >
            </div>
            <!-- WhatsApp Styled Send Button -->
            <button 
              onclick="sendSupportChatReply()" 
              id="support-chat-send-btn" 
              class="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center text-base shadow-lg shadow-emerald-950/40 transition cursor-pointer shrink-0"
              title="إرسال الرسالة"
            >
              <span>➤</span>
            </button>
          </div>

        </div>

      </div>
    </section>

    <!-- ======================================================== -->
    <!-- TAB 8: WALLET SETTINGS (إعدادات وأرقام المحافظ) -->
    <!-- ======================================================== -->
    <section id="tab-content-settings" class="tab-content hidden flex flex-col gap-4 max-w-xl mx-auto w-full">
      <div class="bg-[#10192e] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
          <span>⚙️</span>
          <span>أرقام محافظ استلام التحويلات والإعدادات</span>
        </h2>
        <p class="text-xs text-slate-400">تظهر هذه الأرقام مباشرة للاعبين في صفحة الإيداع عند اختيارهم لطريقة الدفع.</p>

        <form onsubmit="handleSaveSettings(event)" class="flex flex-col gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">رقم فودافون كاش:</label>
            <input type="text" id="setting-vodafone" value="<?= htmlspecialchars($settings['vodafoneNumber'] ?? '') ?>" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">رقم اتصالات كاش:</label>
            <input type="text" id="setting-etisalat" value="<?= htmlspecialchars($settings['etisalatNumber'] ?? '') ?>" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">رقم أورنج كاش:</label>
            <input type="text" id="setting-orange" value="<?= htmlspecialchars($settings['orangeNumber'] ?? '') ?>" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">عنوان / معرف إنستاباي (InstaPay):</label>
            <input type="text" id="setting-instapay" value="<?= htmlspecialchars($settings['instapayNumber'] ?? '') ?>" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">الحد الأدنى للإيداع (ج.م):</label>
              <input type="number" id="setting-min-dep" value="<?= htmlspecialchars($settings['minDeposit'] ?? 10) ?>" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">الحد الأدنى للسحب (ج.م):</label>
              <input type="number" id="setting-min-with" value="<?= htmlspecialchars($settings['minWithdraw'] ?? 50) ?>" class="w-full bg-[#0b101d] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono">
            </div>
          </div>

          <button type="submit" class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition cursor-pointer mt-2">
            💾 حفظ وتحديث الأرقام على المنصة والسيرفر
          </button>
        </form>
      </div>

      <!-- DANGER ZONE: RESET & CLEAN SLATE -->
      <div class="bg-[#1a0f18] border border-red-900/60 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center text-xl font-bold border border-red-500/30">
            ⚠️
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-black text-white">منطقة المسح الشامل والبدء من الصفر (Zero Reset)</h3>
            <p class="text-xs text-red-300">أدوات إدارية لمسح البيانات وتصفير الداشبورد بالكامل للبدء من جديد</p>
          </div>
        </div>

        <div class="bg-red-950/30 border border-red-900/40 rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
          اختر الإجراء الذي تريده أدناه لتصفير الأدمن والتحكم بالبيانات:
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Clear Transactions Button -->
          <button 
            type="button" 
            onclick="clearAllTransactionsPrompt('all')" 
            class="flex-1 py-3 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>📜</span>
            <span>تصفير ومسح جميع طلبات الإيداع والسحب (0 طلبات)</span>
          </button>

          <!-- Master Wipe Reset Button -->
          <button 
            type="button" 
            onclick="masterResetPrompt()" 
            class="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-950 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>💥</span>
            <span>تصفير المنصة بالكامل والبدء من الصفر (0 مستخدمين - 0 طلبات)</span>
          </button>
        </div>
      </div>
    </section>

  </main>

  <!-- CONFIRMATION MODAL FOR DELETING AND BANNING USER -->
  <div id="delete-ban-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center p-4">
    <div class="bg-[#10192e] border border-red-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-red-950/80 flex flex-col gap-4 animate-in zoom-in-95">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-2xl font-bold border border-red-500/30">
          ⚠️
        </div>
        <div class="flex flex-col">
          <h3 class="text-base sm:text-lg font-black text-white">تأكيد حذف وحظر المستخدم والجهاز نهائياً</h3>
          <span class="text-xs text-red-400 font-bold">إجراء أمني دائم لا يمكن الرجوع عنه بسهولة</span>
        </div>
      </div>

      <p class="text-xs text-slate-300 leading-relaxed">
        هل أنت متأكد من رغبتك في حذف هذا المستخدم وحظر جهازه نهائياً؟
        <br>
        <span class="text-amber-400 font-bold">النتيجة:</span> سيتم إغلاق جلسته فوراً وطرده، وحظر رقم هاتفه ومعرف جهازه بحيث لن يتمكن من فتح المنصة أو تسجيل حساب جديد من هذا الجهاز أبداً.
      </p>

      <div class="bg-[#0b101d] border border-slate-800 rounded-2xl p-3.5 text-xs flex flex-col gap-1.5 font-mono">
        <div class="flex justify-between"><span class="text-slate-500">اسم اللاعب:</span> <span id="modal-user-name" class="font-bold text-white"></span></div>
        <div class="flex justify-between"><span class="text-slate-500">معرف اللاعب (ID):</span> <span id="modal-user-id" class="font-bold text-amber-400"></span></div>
        <div class="flex justify-between"><span class="text-slate-500">رقم الهاتف:</span> <span id="modal-user-phone" class="text-cyan-400 font-bold"></span></div>
        <div class="flex justify-between"><span class="text-slate-500">اسم الجهاز:</span> <span id="modal-device-name" class="text-purple-300"></span></div>
        <div class="flex justify-between"><span class="text-slate-500">بصمة الجهاز:</span> <span id="modal-device-id" class="text-red-400 font-bold"></span></div>
      </div>

      <div class="flex items-center gap-2 mt-2">
        <button onclick="executeDeleteAndBan()" id="confirm-ban-btn" class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition cursor-pointer">
          نعم، احذف المستخدم واحظر الجهاز الآن 🚫
        </button>
        <button onclick="closeDeleteModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer">
          إلغاء
        </button>
      </div>
    </div>
  </div>

  <!-- ADVANCED RECEIPT LIGHTBOX MODAL WITH ZOOM & CONTROLS -->
  <div id="receipt-lightbox-modal" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-md hidden flex items-center justify-center p-3 sm:p-6" onclick="closeReceiptLightbox()">
    <div class="bg-[#10192e] border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl" onclick="event.stopPropagation()">
      <!-- Lightbox Header -->
      <div class="bg-[#0b1220] p-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <span class="text-xl">📸</span>
          <div>
            <h3 class="font-bold text-white text-sm flex items-center gap-2">
              <span>فحص إيصال التحويل البنكي / المحفظة</span>
              <span id="lightbox-user-badge" class="text-xs text-amber-400 font-mono font-bold bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-800/80"></span>
            </h3>
            <span id="lightbox-subtitle" class="text-[11px] text-slate-400"></span>
          </div>
        </div>

        <!-- Zoom & Rotate Controls -->
        <div class="flex items-center gap-1.5">
          <button onclick="zoomLightbox(1.25)" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer" title="تكبير الصورة">
            🔍+
          </button>
          <button onclick="zoomLightbox(0.8)" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer" title="تصغير الصورة">
            🔍-
          </button>
          <button onclick="rotateLightbox()" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer" title="تدوير 90 درجة">
            ↻ تدوير
          </button>
          <button onclick="resetLightbox()" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer" title="إعادة الضبط">
            ⟲
          </button>
          <a id="lightbox-open-external" href="#" target="_blank" class="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer" title="فتح الصورة الأصلية في نافذة جديدة">
            ↗️ نافذة خارجية
          </a>
          <button onclick="closeReceiptLightbox()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white font-bold text-sm transition flex items-center justify-center cursor-pointer">
            ✕
          </button>
        </div>
      </div>

      <!-- Lightbox Main Canvas (Image + Quick Info Bar) -->
      <div class="flex-1 overflow-auto bg-black/95 flex items-center justify-center p-4 relative min-h-[360px] max-h-[62vh]">
        <img 
          id="lightbox-img" 
          src="" 
          alt="إيصال التحويل" 
          class="max-w-full max-h-full object-contain rounded-xl transition-transform duration-200"
          style="transform-origin: center center;"
        >
      </div>

      <!-- Lightbox Footer with Verification Details and Action Buttons -->
      <div class="bg-[#0b1220] p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs w-full sm:w-auto">
          <div>
            <span class="text-slate-500 block text-[10px]">المبلغ المطلوب:</span>
            <span id="lightbox-amount" class="font-bold text-emerald-400 font-mono text-sm"></span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px]">رقم المحفظة:</span>
            <span id="lightbox-phone" class="font-bold text-cyan-300 font-mono"></span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px]">كود التحويل:</span>
            <span id="lightbox-ref" class="font-bold text-amber-300 font-mono"></span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px]">معرف المعاملة:</span>
            <span id="lightbox-txid" class="font-bold text-slate-300 font-mono"></span>
          </div>
        </div>

        <div id="lightbox-actions" class="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button 
            id="lightbox-approve-btn" 
            onclick="approveDeposit(currentLightboxTxId)" 
            class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
          >
            <span>موافقة وشحن الرصيد</span>
            <span>✅</span>
          </button>
          <button 
            id="lightbox-reject-btn" 
            onclick="openRejectFromLightbox()" 
            class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
          >
            <span>رفض الطلب</span>
            <span>❌</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- REJECT DEPOSIT REASON MODAL -->
  <div id="reject-deposit-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center p-4" onclick="closeRejectDepositModal()">
    <div class="bg-[#10192e] border border-slate-700 rounded-3xl max-w-md w-full p-5 flex flex-col gap-4 shadow-2xl" onclick="event.stopPropagation()">
      <div class="flex justify-between items-center border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="text-red-400 text-lg">❌</span>
          <h3 class="font-black text-white text-sm">تحديد سبب رفض طلب الإيداع</h3>
        </div>
        <button onclick="closeRejectDepositModal()" class="text-slate-400 hover:text-white font-bold text-sm cursor-pointer">✕</button>
      </div>

      <div class="bg-[#0b101d] rounded-xl p-3 border border-slate-800 text-xs flex flex-col gap-1">
        <div class="flex justify-between"><span class="text-slate-400">اللاعب:</span> <span id="reject-user-name" class="font-bold text-white"></span></div>
        <div class="flex justify-between"><span class="text-slate-400">المبلغ:</span> <span id="reject-user-amt" class="font-bold text-emerald-400 font-mono"></span></div>
        <div class="flex justify-between"><span class="text-slate-400">كود المعاملة:</span> <span id="reject-tx-id" class="font-mono text-amber-400"></span></div>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-slate-300">أسباب شائعة جاهزة (اضغط لاختيار فوري):</label>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" onclick="selectRejectReason('لم يتم استلام المبلغ على المحفظة')" class="reject-chip px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
            لم يتم استلام المبلغ ❌
          </button>
          <button type="button" onclick="selectRejectReason('صورة الإيصال غير واضحة أو مقطوعة')" class="reject-chip px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
            الإيصال غير واضح 📸
          </button>
          <button type="button" onclick="selectRejectReason('كود أو رقم التحويل غير مطابق')" class="reject-chip px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
            كود التحويل غير مطابق ⚠️
          </button>
          <button type="button" onclick="selectRejectReason('المبلغ المحول أقل من المطلوب')" class="reject-chip px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
            المبلغ المحول أقل 📉
          </button>
          <button type="button" onclick="selectRejectReason('رقم المحفظة المحول منها غير صحيح')" class="reject-chip px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer">
            رقم المحفظة غير صحيح 📱
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold text-slate-300">نص سبب الرفض (يظهر للاعب في إشعارات حسابه):</label>
        <textarea 
          id="reject-reason-input" 
          rows="2" 
          placeholder="اكتب سبب الرفض هنا..." 
          class="w-full bg-[#0b101d] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
        >لم يتم استلام المبلغ على المحفظة</textarea>
      </div>

      <div class="flex items-center gap-2 pt-2 border-t border-slate-800">
        <button 
          type="button" 
          onclick="confirmRejectDeposit()" 
          class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-900/40 transition cursor-pointer"
        >
          تأكيد رفض الطلب ❌
        </button>
        <button 
          type="button" 
          onclick="closeRejectDepositModal()" 
          class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
        >
          إلغاء
        </button>
      </div>
    </div>
  </div>

  <!-- VIEW RECEIPT IMAGE MODAL (Simple fallback) -->
  <div id="receipt-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center p-4" onclick="this.classList.add('hidden')">
    <div class="bg-[#10192e] border border-slate-700 rounded-2xl p-4 max-w-lg w-full flex flex-col gap-3" onclick="event.stopPropagation()">
      <div class="flex justify-between items-center border-b border-slate-800 pb-2">
        <span class="font-bold text-white text-xs">صورة إيصال التحويل البنكي / المحفظة</span>
        <button onclick="document.getElementById('receipt-modal').classList.add('hidden')" class="text-slate-400 hover:text-white font-bold text-sm cursor-pointer">✕</button>
      </div>
      <img id="receipt-modal-img" src="" alt="إيصال التحويل" class="w-full max-h-[70vh] object-contain rounded-xl bg-black">
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- MODAL: COMPREHENSIVE PLAYER PROFILE & ACCOUNT CONTROLLER -->
  <!-- بروفايل اللاعب الشامل والتحكم الكامل في الحساب -->
  <!-- ======================================================== -->
  <div id="player-profile-modal" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md hidden flex items-center justify-center p-3 sm:p-5 overflow-y-auto custom-scrollbar" onclick="if(event.target === this) closePlayerProfileModal()">
    <div class="bg-[#0f172a] border border-slate-700/80 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in zoom-in-95" onclick="event.stopPropagation()">
      
      <!-- Modal Header -->
      <div class="bg-gradient-to-r from-[#111c35] via-[#0f172a] to-[#1e1b4b] p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div class="flex items-center gap-3">
          <div id="ppm-avatar" class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg border border-blue-400/30">
            ل
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 id="ppm-username" class="text-base sm:text-lg font-black text-white">اسم اللاعب</h3>
              <span id="ppm-status-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>متصل الآن</span>
              </span>
              <span id="ppm-banned-badge" class="hidden px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                🚫 محظور
              </span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-xs text-slate-400 font-mono">
              <span class="text-amber-400 font-bold" id="ppm-userid-badge">ID: #000000</span>
              <span>•</span>
              <span id="ppm-userphone" class="text-slate-300">01000000000</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            type="button" 
            onclick="closePlayerProfileModal()" 
            class="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-red-700 text-slate-400 hover:text-white flex items-center justify-center text-lg font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5">

        <!-- 1. Top Balance & Financial Highlights -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <!-- Live Balance Card -->
          <div class="bg-gradient-to-br from-emerald-950/40 via-[#0e2417] to-[#0b1b11] border border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div class="flex items-center justify-between">
              <span class="text-xs text-emerald-300 font-bold">💰 الرصيد الحالي الفعلي</span>
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-emerald-400 font-mono my-2 flex items-baseline gap-1">
              <span id="ppm-current-balance">0.00</span>
              <span class="text-xs text-emerald-500 font-normal">ج.م</span>
            </div>
            <span class="text-[10px] text-slate-400">الرصيد المتاح للعب والسحب في حساب اللاعب الآن</span>
          </div>

          <!-- Total Deposits Card -->
          <div class="bg-[#111c33] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-md">
            <span class="text-xs text-slate-400 font-medium">📥 إجمالي الإيداعات المؤكدة</span>
            <div class="text-xl sm:text-2xl font-black text-white font-mono my-2 flex items-baseline gap-1">
              <span id="ppm-total-deposits">0.00</span>
              <span class="text-xs text-slate-400 font-normal">ج.م</span>
            </div>
            <span class="text-[10px] text-slate-500" id="ppm-deposits-count">0 عمليات إيداع مقبولة</span>
          </div>

          <!-- Total Withdrawals Card -->
          <div class="bg-[#111c33] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-md">
            <span class="text-xs text-slate-400 font-medium">📤 إجمالي السحوبات المؤكدة</span>
            <div class="text-xl sm:text-2xl font-black text-purple-400 font-mono my-2 flex items-baseline gap-1">
              <span id="ppm-total-withdraws">0.00</span>
              <span class="text-xs text-purple-500 font-normal">ج.م</span>
            </div>
            <span class="text-[10px] text-slate-500" id="ppm-withdraws-count">0 عمليات سحب مؤكدة</span>
          </div>
        </div>

        <!-- 2. Balance Management & Instant Recharge / Deduct Panel -->
        <div class="bg-[#111c33] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-black text-white flex items-center gap-2">
              <span>💳</span>
              <span>التحكم بالرصيد (شحن فوري / خصم / تعيين دقيق)</span>
            </h4>
            <span class="text-[10px] text-slate-400">يظهر للاعب على جهازه مباشرة وفورياً</span>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch gap-3">
            <div class="flex-1 relative">
              <input 
                type="number" 
                id="ppm-balance-input" 
                placeholder="أدخل المبلغ (مثال: 100 أو 500)..." 
                class="w-full bg-[#0b101d] border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none transition shadow-inner"
              >
            </div>

            <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button 
                type="button" 
                onclick="ppmAdjustBalance('add')" 
                class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950 cursor-pointer flex items-center justify-center gap-1"
              >
                <span>➕</span>
                <span>إضافة رصيد</span>
              </button>

              <button 
                type="button" 
                onclick="ppmAdjustBalance('deduct')" 
                class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-md shadow-amber-950 cursor-pointer flex items-center justify-center gap-1"
              >
                <span>➖</span>
                <span>خصم رصيد</span>
              </button>

              <button 
                type="button" 
                onclick="ppmAdjustBalance('set')" 
                class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-950 cursor-pointer flex items-center justify-center gap-1"
              >
                <span>✏️</span>
                <span>تعيين بالتمام</span>
              </button>
            </div>
          </div>

          <!-- Quick presets -->
          <div class="flex items-center gap-1.5 flex-wrap text-xs pt-1">
            <span class="text-slate-500 text-[11px]">مبالغ سريعة:</span>
            <button type="button" onclick="document.getElementById('ppm-balance-input').value='50'" class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] cursor-pointer">+50</button>
            <button type="button" onclick="document.getElementById('ppm-balance-input').value='100'" class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] cursor-pointer">+100</button>
            <button type="button" onclick="document.getElementById('ppm-balance-input').value='200'" class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] cursor-pointer">+200</button>
            <button type="button" onclick="document.getElementById('ppm-balance-input').value='500'" class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] cursor-pointer">+500</button>
            <button type="button" onclick="document.getElementById('ppm-balance-input').value='1000'" class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] cursor-pointer">+1000</button>
          </div>
        </div>

        <!-- 3. Player Profit Cap / Game Multiplier Control -->
        <div class="bg-[#111c33] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-black text-white flex items-center gap-2">
              <span>🎯</span>
              <span>حد أرباح هذا اللاعب (الفرقعة / إيقاف السحب واللعب عند ليميت محدد)</span>
            </h4>
            <span class="text-[10px] text-amber-400 font-bold">تحكم خاص بهذا اللاعب</span>
          </div>

          <p class="text-xs text-slate-400 leading-relaxed">
            يمكنك تحديد سقف أقصى لأرباح هذا اللاعب بالتحديد (مثلاً إذا شحن 300 يفرقع عند 1500 بالضبط أو أي رقم تحدده). عند بلوغ هذا الحد لا يستطيع اللاعب مواصلة اللعب أو السحب حتى يشحن مجدداً.
          </p>

          <div class="flex flex-col sm:flex-row items-center gap-3">
            <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
              <input type="checkbox" id="ppm-limit-toggle" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700 cursor-pointer">
              <span class="font-bold">تفعيل حد الأرباح لهذا اللاعب</span>
            </label>

            <div class="flex-1 w-full sm:w-auto relative">
              <input 
                type="number" 
                id="ppm-limit-input" 
                placeholder="أدخل سقف الرصيد (مثال: 1500 أو 2500)..." 
                class="w-full bg-[#0b101d] border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none transition"
              >
            </div>

            <button 
              type="button" 
              onclick="ppmSaveProfitLimit()" 
              class="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs transition cursor-pointer shadow-md"
            >
              حفظ حد الأرباح
            </button>
          </div>
        </div>

        <!-- 4. Device Specs & System Intelligence -->
        <div class="bg-[#111c33] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <h4 class="text-sm font-black text-white flex items-center gap-2">
            <span>📱</span>
            <span>بيانات الجهاز المتصل ونظام التشغيل والبصمة الرقمية</span>
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div class="bg-[#0b101d] p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
              <span class="text-slate-500 text-[10px]">نوع واسم الجهاز:</span>
              <span id="ppm-dev-name" class="font-bold text-cyan-300 font-mono">هاتف ذكي</span>
            </div>
            <div class="bg-[#0b101d] p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
              <span class="text-slate-500 text-[10px]">نظام التشغيل (OS):</span>
              <span id="ppm-dev-os" class="font-bold text-white font-mono">Android / iOS</span>
            </div>
            <div class="bg-[#0b101d] p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
              <span class="text-slate-500 text-[10px]">المتصفح:</span>
              <span id="ppm-dev-browser" class="font-bold text-slate-300 font-mono">Chrome / Safari</span>
            </div>
            <div class="bg-[#0b101d] p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
              <span class="text-slate-500 text-[10px]">بصمة الجهاز (Device ID):</span>
              <span id="ppm-dev-id" class="font-bold text-amber-400 font-mono truncate" title="">DEV-N/A</span>
            </div>
          </div>
        </div>

        <!-- 5. User Transactions History Table -->
        <div class="bg-[#111c33] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-black text-white flex items-center gap-2">
              <span>📜</span>
              <span>سجل جميع معاملات هذا اللاعب (إيداعات وسحوبات)</span>
            </h4>
            <span class="text-[10px] text-slate-400" id="ppm-tx-count">0 معاملة</span>
          </div>

          <div class="max-h-60 overflow-y-auto custom-scrollbar border border-slate-800 rounded-xl">
            <table class="w-full text-right text-xs">
              <thead class="bg-[#0b101d] text-slate-400 font-bold border-b border-slate-800 sticky top-0">
                <tr>
                  <th class="p-2.5">النوع</th>
                  <th class="p-2.5">المبلغ</th>
                  <th class="p-2.5">طريقة الدفع</th>
                  <th class="p-2.5">التاريخ والوقت</th>
                  <th class="p-2.5 text-center">الحالة</th>
                  <th class="p-2.5 text-center">الإيصال</th>
                </tr>
              </thead>
              <tbody id="ppm-tx-tbody" class="divide-y divide-slate-800/60 font-medium">
                <tr>
                  <td colspan="6" class="p-4 text-center text-slate-500">لا توجد معاملات مسجلة لهذا اللاعب حتى الآن</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 6. Account Actions, Bans, & Session Controls (منطقة التحكم والحظر) -->
        <div class="bg-[#170e17] border border-red-900/50 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <h4 class="text-sm font-black text-red-300 flex items-center gap-2">
            <span>🛡️</span>
            <span>إجراءات الأمان والحظر وطرد اللاعب</span>
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <!-- Action A: Toggle Ban / Unban -->
            <button 
              type="button" 
              id="ppm-toggle-ban-btn" 
              onclick="ppmToggleBan()" 
              class="py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40"
            >
              <span>🚫</span>
              <span id="ppm-toggle-ban-text">حظر الحساب والجهاز</span>
            </button>

            <!-- Action B: Force Disconnect / Logout -->
            <button 
              type="button" 
              onclick="ppmForceLogout()" 
              class="py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40"
              title="تسجيل خروج اللاعب فوراً من جهازه"
            >
              <span>🚪</span>
              <span>تسجيل خروج إجباري وقطع الاتصال</span>
            </button>

            <!-- Action C: Open Direct Support Chat -->
            <button 
              type="button" 
              onclick="ppmOpenChat()" 
              class="py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40"
            >
              <span>💬</span>
              <span>محادثة دعم فني مباشرة</span>
            </button>
          </div>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="bg-[#0b101d] p-3.5 border-t border-slate-800 flex items-center justify-between shrink-0">
        <span class="text-[11px] text-slate-500 font-mono">1X WINNER • نظام إدارة الحسابات المباشر</span>
        <button 
          type="button" 
          onclick="closePlayerProfileModal()" 
          class="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
        >
          إغلاق
        </button>
      </div>

    </div>
  </div>

  <!-- TOAST CONTAINER -->
  <div id="toast-container" class="fixed bottom-5 left-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm"></div>

  <!-- JAVASCRIPT CLIENT LOGIC -->
  <script>
    // Global Players Data Store
    window.ADMIN_USERS_DATA = <?= json_encode($usersList, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?> || [];
    window.CURRENT_PROFILE_USER = null;

    // Switch between Cards Grid (مربعات) and Detailed Table
    function switchUsersView(mode) {
      const cardsView = document.getElementById('users-cards-view');
      const tableView = document.getElementById('users-table-view');
      const btnCards = document.getElementById('users-view-cards-btn');
      const btnTable = document.getElementById('users-view-table-btn');

      if (mode === 'cards') {
        if (cardsView) cardsView.classList.remove('hidden');
        if (tableView) tableView.classList.add('hidden');
        if (btnCards) {
          btnCards.classList.remove('text-slate-400');
          btnCards.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
        }
        if (btnTable) {
          btnTable.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
          btnTable.classList.add('text-slate-400');
        }
      } else {
        if (cardsView) cardsView.classList.add('hidden');
        if (tableView) tableView.classList.remove('hidden');
        if (btnTable) {
          btnTable.classList.remove('text-slate-400');
          btnTable.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
        }
        if (btnCards) {
          btnCards.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
          btnCards.classList.add('text-slate-400');
        }
      }
    }

    // Open Comprehensive Player Profile Modal
    function openPlayerProfileModal(userId) {
      if (!userId) return;
      const user = window.ADMIN_USERS_DATA.find(u => String(u.id) === String(userId));
      if (!user) {
        showToast('لم يتم العثور على بيانات هذا اللاعب', 'error');
        return;
      }
      window.CURRENT_PROFILE_USER = user;

      // Populate Header
      document.getElementById('ppm-username').innerText = user.username || 'لاعب';
      document.getElementById('ppm-userid-badge').innerText = `ID: #${user.id}`;
      document.getElementById('ppm-userphone').innerText = user.phone || 'بدون رقم هاتف مسجل';
      document.getElementById('ppm-avatar').innerText = (user.username || 'ل').charAt(0).toUpperCase();

      // Status badges
      const isOnline = !!user.isCurrentlyOnline;
      const isBanned = !!user.isBanned;

      const stBadge = document.getElementById('ppm-status-badge');
      if (isOnline) {
        stBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1';
        stBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span>متصل الآن</span>';
        stBadge.classList.remove('hidden');
      } else {
        stBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1';
        stBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span><span>غير متصل</span>';
        stBadge.classList.remove('hidden');
      }

      const banBadge = document.getElementById('ppm-banned-badge');
      if (isBanned) {
        banBadge.classList.remove('hidden');
      } else {
        banBadge.classList.add('hidden');
      }

      // Populate Balance & Stats
      const bal = Number(user.balance || 0);
      document.getElementById('ppm-current-balance').innerText = bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.getElementById('ppm-total-deposits').innerText = Number(user.depositsTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.getElementById('ppm-deposits-count').innerText = `${user.depositsCount || 0} عمليات إيداع مقبولة`;
      document.getElementById('ppm-total-withdraws').innerText = Number(user.withdrawsTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.getElementById('ppm-withdraws-count').innerText = `${user.withdrawsCount || 0} عمليات سحب مؤكدة`;

      // Clear balance input
      document.getElementById('ppm-balance-input').value = '';

      // Populate Profit Limit
      const limitToggle = document.getElementById('ppm-limit-toggle');
      const limitInput = document.getElementById('ppm-limit-input');
      limitToggle.checked = !!user.profitLimitEnabled;
      limitInput.value = user.customProfitLimit || '';

      // Populate Device Specs
      document.getElementById('ppm-dev-name').innerText = user.deviceName || 'غير محدد';
      document.getElementById('ppm-dev-os').innerText = user.deviceOS || 'غير محدد';
      document.getElementById('ppm-dev-browser').innerText = user.deviceBrowser || 'متصفح ويب';
      const devIdEl = document.getElementById('ppm-dev-id');
      devIdEl.innerText = user.deviceId || 'DEV-N/A';
      devIdEl.title = user.deviceId || '';

      // Populate Transactions
      const txs = user.transactions || [];
      document.getElementById('ppm-tx-count').innerText = `${txs.length} معاملة`;
      const tbody = document.getElementById('ppm-tx-tbody');

      if (txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">لا توجد معاملات مسجلة لهذا اللاعب حتى الآن</td></tr>';
      } else {
        let rowsHtml = '';
        txs.forEach(t => {
          const isDep = t.type === 'deposit';
          const typeBadge = isDep 
            ? '<span class="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-bold text-[10px]">📥 إيداع</span>'
            : '<span class="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 font-bold text-[10px]">📤 سحب</span>';
          
          let stBadge = '';
          if (t.status === 'completed') {
            stBadge = '<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">مقبول ✅</span>';
          } else if (t.status === 'rejected') {
            stBadge = '<span class="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-bold text-[10px]">مرفوض ❌</span>';
          } else {
            stBadge = '<span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-bold text-[10px] animate-pulse">معلق ⏳</span>';
          }

          const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleString('ar-EG') : 'غير محدد';
          const receiptBtn = t.receiptUrl 
            ? `<button onclick="openReceiptLightbox('${t.receiptUrl}', '${user.username}', '${user.id}', '${t.amount}', '${user.phone}', '${t.referenceCode || ''}', '${t.id}', '${t.status}')" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer">📸 فحص</button>`
            : '<span class="text-slate-600 text-[10px]">-</span>';

          rowsHtml += `
            <tr class="hover:bg-slate-800/40 transition">
              <td class="p-2.5 font-mono">${typeBadge}</td>
              <td class="p-2.5 font-bold font-mono ${isDep ? 'text-emerald-400' : 'text-purple-400'}">${Number(t.amount || 0).toLocaleString()} ج.م</td>
              <td class="p-2.5 text-slate-300 text-[11px]">${t.method || 'محفظة إلكترونية'}</td>
              <td class="p-2.5 font-mono text-[11px] text-slate-400">${dateStr}</td>
              <td class="p-2.5 text-center">${stBadge}</td>
              <td class="p-2.5 text-center">${receiptBtn}</td>
            </tr>
          `;
        });
        tbody.innerHTML = rowsHtml;
      }

      // Update Ban button
      const banBtn = document.getElementById('ppm-toggle-ban-btn');
      const banBtnText = document.getElementById('ppm-toggle-ban-text');
      if (isBanned) {
        banBtn.className = 'py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40';
        banBtnText.innerText = 'فك الحظر عن الحساب والجهاز';
      } else {
        banBtn.className = 'py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40';
        banBtnText.innerText = 'حظر الحساب والجهاز نهائياً';
      }

      // Show Modal
      document.getElementById('player-profile-modal').classList.remove('hidden');
    }

    function closePlayerProfileModal() {
      document.getElementById('player-profile-modal').classList.add('hidden');
      window.CURRENT_PROFILE_USER = null;
    }

    // Adjust User Balance (Add / Deduct / Set)
    async function ppmAdjustBalance(mode) {
      if (!window.CURRENT_PROFILE_USER) return;
      const input = document.getElementById('ppm-balance-input');
      const amount = parseFloat(input.value);

      if (isNaN(amount) || amount <= 0) {
        showToast('يرجى كتابة مبلغ صحيح أكبر من صفر', 'error');
        input.focus();
        return;
      }

      const modeLabel = mode === 'add' ? `إضافة ${amount} ج.م إلى رصيد` : (mode === 'deduct' ? `خصم ${amount} ج.م من رصيد` : `تعيين الرصيد ليكون ${amount} ج.م بالضبط لـ`);
      if (!confirm(`هل أنت متأكد من ${modeLabel} اللاعب (${window.CURRENT_PROFILE_USER.username})؟`)) {
        return;
      }

      try {
        const res = await fetch('index.php?action=update_user_balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: window.CURRENT_PROFILE_USER.id,
            mode: mode,
            amount: amount
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          // Update local state
          window.CURRENT_PROFILE_USER.balance = data.newBalance;
          document.getElementById('ppm-current-balance').innerText = Number(data.newBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          input.value = '';

          // Update on page without reload
          const card = document.querySelector(`.user-card[data-userid="${window.CURRENT_PROFILE_USER.id}"]`);
          if (card) {
            const balEl = card.querySelector('.font-mono.text-emerald-400 span');
            if (balEl) balEl.innerText = Number(data.newBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }

          // Broadcast sync
          try {
            const ch = new BroadcastChannel('1xwinner_sync');
            ch.postMessage({ type: 'USER_BALANCE_CHANGED', userId: window.CURRENT_PROFILE_USER.id, balance: data.newBalance });
          } catch(e) {}
        } else {
          showToast(data.error || 'فشلت عملية تعديل الرصيد', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      }
    }

    // Save Profit Cap Limit for Player
    async function ppmSaveProfitLimit() {
      if (!window.CURRENT_PROFILE_USER) return;
      const toggle = document.getElementById('ppm-limit-toggle');
      const input = document.getElementById('ppm-limit-input');
      const enabled = toggle.checked;
      const limit = parseFloat(input.value) || 0;

      if (enabled && limit <= 0) {
        showToast('يرجى إدخال سقف أرباح صحيح أكبر من الصفر', 'error');
        input.focus();
        return;
      }

      try {
        const res = await fetch('index.php?action=update_user_profit_limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: window.CURRENT_PROFILE_USER.id,
            limit: limit,
            enabled: enabled
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          window.CURRENT_PROFILE_USER.profitLimitEnabled = enabled;
          window.CURRENT_PROFILE_USER.customProfitLimit = limit;
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast(data.error || 'فشل حفظ حد الأرباح', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      }
    }

    // Toggle Ban / Unban from Profile Modal
    async function ppmToggleBan() {
      if (!window.CURRENT_PROFILE_USER) return;
      const isCurrentlyBanned = !!window.CURRENT_PROFILE_USER.isBanned;
      const nextBan = !isCurrentlyBanned;
      const actionTxt = nextBan ? 'حظر هذا اللاعب وجهازه نهائياً' : 'فك الحظر عن هذا اللاعب وجهازه';

      if (!confirm(`هل أنت متأكد من ${actionTxt}؟`)) return;

      try {
        const res = await fetch('index.php?action=toggle_user_ban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: window.CURRENT_PROFILE_USER.id,
            ban: nextBan,
            reason: nextBan ? 'مخالفة شروط الاستخدام والألعاب' : null
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast(data.error || 'فشلت عملية تغيير حالة الحظر', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      }
    }

    // Force Logout & Disconnect Session
    async function ppmForceLogout() {
      if (!window.CURRENT_PROFILE_USER) return;
      if (!confirm(`هل أنت متأكد من تسجيل خروج اللاعب (${window.CURRENT_PROFILE_USER.username}) فوراً من جهازه وإغلاق جلسته؟`)) return;

      try {
        const res = await fetch('index.php?action=force_logout_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: window.CURRENT_PROFILE_USER.id })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
        } else {
          showToast(data.error || 'فشلت العملية', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      }
    }

    // Open Chat with Player from Profile Modal
    function ppmOpenChat() {
      if (!window.CURRENT_PROFILE_USER) return;
      const uid = window.CURRENT_PROFILE_USER.id;
      closePlayerProfileModal();
      openSupportChatForUser(uid);
    }

    // Open Support Chat for User
    function openSupportChatForUser(userId) {
      switchTab('support');
      setTimeout(() => {
        if (typeof selectSupportChat === 'function') {
          selectSupportChat(userId);
        }
      }, 150);
    }

    // Quick recharge prompt
    async function quickRechargePrompt(userId, amount) {
      if (!confirm(`شحن مباشر وفوري بمبلغ ${amount} ج.م لحساب اللاعب؟`)) return;
      try {
        const res = await fetch('index.php?action=direct_recharge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast(data.error || 'فشلت العملية', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال', 'error');
      }
    }

    // Quick Toggle Ban
    async function quickToggleBan(userId, ban) {
      const msg = ban ? 'حظر هذا اللاعب' : 'فك الحظر عن هذا اللاعب';
      if (!confirm(`هل أنت متأكد من ${msg}؟`)) return;
      try {
        const res = await fetch('index.php?action=toggle_user_ban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ban })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast(data.error || 'فشلت العملية', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال', 'error');
      }
    }

    // Tab Switching
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-600/30');
        el.classList.add('bg-slate-800/80', 'text-slate-300');
      });

      const content = document.getElementById(`tab-content-${tabId}`);
      const btn = document.getElementById(`tab-btn-${tabId}`);
      if (content) content.classList.remove('hidden');
      if (btn) {
        btn.classList.remove('bg-slate-800/80', 'text-slate-300');
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-600/30');
      }
    }

    // Filter Devices Table & Cards Live
    function filterDevicesTable() {
      const q = (document.getElementById('devices-search-input').value || '').toLowerCase().trim();
      const rows = document.querySelectorAll('.device-row');
      const cards = document.querySelectorAll('.user-card');

      rows.forEach(r => {
        const text = r.getAttribute('data-search') || '';
        if (!q || text.includes(q)) {
          r.style.display = '';
        } else {
          r.style.display = 'none';
        }
      });

      cards.forEach(c => {
        const text = c.getAttribute('data-search') || '';
        if (!q || text.includes(q)) {
          c.style.display = '';
        } else {
          c.style.display = 'none';
        }
      });
    }

    // Toast Notifications
    function showToast(msg, type = 'info') {
      const container = document.getElementById('toast-container');
      const el = document.createElement('div');
      const bg = type === 'success' ? 'bg-emerald-600 border-emerald-400' : (type === 'error' ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400');
      el.className = `py-3 px-4 rounded-2xl shadow-2xl text-xs font-bold text-white transition-all transform animate-in slide-in-from-bottom border ${bg} pointer-events-auto`;
      el.innerText = msg;
      container.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }

    // Modal delete data
    let currentTargetUser = null;

    function openDeleteModal(userId, username, phone, deviceId, deviceName) {
      currentTargetUser = { userId, username, phone, deviceId, deviceName };
      document.getElementById('modal-user-id').innerText = userId;
      document.getElementById('modal-user-name').innerText = username;
      document.getElementById('modal-user-phone').innerText = phone || 'غير متوفر';
      document.getElementById('modal-device-id').innerText = deviceId || 'DEV-N/A';
      document.getElementById('modal-device-name').innerText = deviceName || 'هاتف / كمبيوتر';
      document.getElementById('delete-ban-modal').classList.remove('hidden');
    }

    function closeDeleteModal() {
      document.getElementById('delete-ban-modal').classList.add('hidden');
      currentTargetUser = null;
    }

    // Execute Delete & Ban
    async function executeDeleteAndBan() {
      if (!currentTargetUser) return;
      const btn = document.getElementById('confirm-ban-btn');
      btn.innerText = 'جاري الحظر والحذف...';
      btn.disabled = true;

      try {
        const res = await fetch('index.php?action=delete_ban_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentTargetUser.userId,
            username: currentTargetUser.username,
            phone: currentTargetUser.phone,
            deviceId: currentTargetUser.deviceId,
            reason: 'تم الحظر بواسطة لوحة تحكم الإدارة'
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          // Broadcast to client tabs if BroadcastChannel available
          try {
            const ch = new BroadcastChannel('1xwinner_sync');
            ch.postMessage({ type: 'USER_BANNED', data: currentTargetUser });
          } catch(e) {}
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast(data.error || 'فشلت العملية', 'error');
          btn.innerText = 'نعم، احذف المستخدم واحظر الجهاز الآن 🚫';
          btn.disabled = false;
        }
      } catch (err) {
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
        btn.innerText = 'نعم، احذف المستخدم واحظر الجهاز الآن 🚫';
        btn.disabled = false;
      }
    }

    // Unban
    async function unbanIdentifier(key) {
      if (!confirm(`هل أنت متأكد من رغبتك في فك الحظر عن (${key})؟`)) return;
      try {
        const res = await fetch('index.php?action=unban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: key })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast(data.error || 'فشل فك الحظر', 'error');
        }
      } catch (e) {
        showToast('خطأ في الاتصال', 'error');
      }
    }

    // Approve Deposit
    async function approveDeposit(txId) {
      if (!confirm('هل تأكدت من وصول المبلغ في محفظتك وتريد شحن رصيد اللاعب الآن؟')) return;
      try {
        const res = await fetch('index.php?action=approve_deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast(data.error || 'حدث خطأ', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال', 'error');
      }
    }

    // Reject Deposit
    async function rejectDeposit(txId) {
      const reason = prompt('سبب رفض الإيداع:', 'لم يتم استلام التحويل');
      if (reason === null) return;
      try {
        const res = await fetch('index.php?action=reject_deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId, reason })
        });
        const data = await res.json();
        if (data.success) {
          showToast('تم رفض الإيداع', 'info');
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch(e) {}
    }

    // Approve Withdraw
    async function approveWithdraw(txId) {
      if (!confirm('هل قمت بتحويل المبلغ إلى رقم المحفظة وتريد تأكيد السحب؟')) return;
      try {
        const res = await fetch('index.php?action=approve_withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId })
        });
        const data = await res.json();
        if (data.success) {
          showToast('تم تأكيد التحويل للاعب', 'success');
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch(e) {}
    }

    // Reject Withdraw
    async function rejectWithdraw(txId) {
      const reason = prompt('سبب رفض السحب وإرجاع المبلغ لمحفظة اللاعب:', 'رقم المحفظة غير صحيح');
      if (reason === null) return;
      try {
        const res = await fetch('index.php?action=reject_withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId, reason })
        });
        const data = await res.json();
        if (data.success) {
          showToast('تم رفض السحب وإرجاع الرصيد للاعب', 'info');
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch(e) {}
    }

    // Direct Recharge
    async function handleDirectRecharge(e) {
      e.preventDefault();
      const userId = document.getElementById('recharge-user-id').value.trim();
      const amount = parseFloat(document.getElementById('recharge-amount').value);
      if (!userId || isNaN(amount) || amount <= 0) return;

      try {
        const res = await fetch('index.php?action=direct_recharge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          document.getElementById('recharge-user-id').value = '';
          document.getElementById('recharge-amount').value = '';
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast(data.error || 'فشلت العملية', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال', 'error');
      }
    }

    // Crash Multiplier
    async function setCrashMultiplier() {
      const val = parseFloat(document.getElementById('crash-multiplier-val').value);
      try {
        const res = await fetch('index.php?action=set_crash_multiplier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ multiplier: isNaN(val) ? 0 : val })
        });
        const data = await res.json();
        showToast(data.message || 'تم تحديث مضاعف الطيارة', 'success');
      } catch(e) {}
    }

    // Save Settings
    async function handleSaveSettings(e) {
      e.preventDefault();
      const settings = {
        vodafoneNumber: document.getElementById('setting-vodafone').value.trim(),
        etisalatNumber: document.getElementById('setting-etisalat').value.trim(),
        orangeNumber: document.getElementById('setting-orange').value.trim(),
        instapayNumber: document.getElementById('setting-instapay').value.trim(),
        minDeposit: parseFloat(document.getElementById('setting-min-dep').value) || 10,
        minWithdraw: parseFloat(document.getElementById('setting-min-with').value) || 50,
      };

      try {
        const res = await fetch('index.php?action=save_settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const data = await res.json();
        showToast(data.message || 'تم حفظ الإعدادات بنجاح', 'success');
      } catch(e) {}
    }

    // Reply Support Ticket
    async function replySupportTicket(ticketId) {
      const input = document.getElementById(`reply-input-${ticketId}`);
      const text = input ? input.value.trim() : '';
      if (!text) return;

      try {
        await fetch('index.php?action=reply_support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId, text })
        });
        showToast('تم إرسال الرد للاعب بنجاح', 'success');
        input.value = '';
        setTimeout(() => window.location.reload(), 1000);
      } catch(e) {}
    }

    // Filter Users by Online Status
    function filterOnlineStatus(mode) {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'border-blue-500');
        b.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
      });
      const activeBtn = document.getElementById(`filter-btn-${mode}`);
      if (activeBtn) {
        activeBtn.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700');
        activeBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-500');
      }

      const rows = document.querySelectorAll('.device-row, .user-row');
      const cards = document.querySelectorAll('.user-card');

      rows.forEach(r => {
        const isOnline = r.getAttribute('data-online') === 'true';
        if (mode === 'all') {
          r.style.display = '';
        } else if (mode === 'online') {
          r.style.display = isOnline ? '' : 'none';
        } else if (mode === 'offline') {
          r.style.display = !isOnline ? '' : 'none';
        }
      });

      cards.forEach(c => {
        const isOnline = c.getAttribute('data-online') === 'true';
        if (mode === 'all') {
          c.style.display = '';
        } else if (mode === 'online') {
          c.style.display = isOnline ? '' : 'none';
        } else if (mode === 'offline') {
          c.style.display = !isOnline ? '' : 'none';
        }
      });
    }

    // Delete User Only (Without Ban)
    async function deleteUserOnly(userId, username) {
      if (!confirm(`هل أنت متأكد من مسح حساب اللاعب (${username} - ID: ${userId}) نهائياً من قاعدة البيانات؟`)) return;
      try {
        const res = await fetch('index.php?action=delete_user_only', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'تم مسح اللاعب بنجاح', 'success');
          const row = document.querySelector(`.user-row[data-uid="${userId}"]`);
          if (row) row.remove();
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast(data.error || 'فشلت عملية مسح اللاعب', 'error');
        }
      } catch (err) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      }
    }

    // Delete a single transaction (Deposit / Withdraw)
    async function deleteTx(txId) {
      if (!confirm(`هل أنت متأكد من رغبتك في مسح هذا الطلب (${txId}) نهائياً؟`)) return;
      try {
        const res = await fetch('index.php?action=delete_transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'تم مسح المعاملة بنجاح', 'success');
          const rows = document.querySelectorAll(`.tx-row[data-txid="${txId}"]`);
          rows.forEach(r => r.remove());
        } else {
          showToast(data.error || 'فشل مسح المعاملة', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال', 'error');
      }
    }

    // Clear All Transactions (Deposits and/or Withdrawals)
    async function clearAllTransactionsPrompt(type = 'all') {
      const label = type === 'deposit' ? 'طلبات الإيداع' : (type === 'withdraw' ? 'طلبات السحب' : 'جميع طلبات الإيداع والسحب');
      if (!confirm(`تحذير: هل أنت متأكد من مسح وتصفير (${label}) بالكامل؟ سيتم تصفير القائمة إلى 0 طلبات.`)) return;

      try {
        const res = await fetch('index.php?action=clear_all_transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'تم تصفير ومسح المعاملات بنجاح', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast(data.error || 'فشلت عملية التصفير', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      }
    }

    // Master Reset: Wipe platform to Zero
    async function masterResetPrompt() {
      const confirm1 = confirm('⚠️ تحذير شديد الأهمية: هل أنت متأكد من تصفير المنصة بالكامل والبدء من الصفر؟\n\nسيتم مسح: كافة اللاعبين، كافة طلبات الإيداع والسحب، وكافة تذاكر الدعم لتصبح المنصة 0 تماماً!');
      if (!confirm1) return;

      const confirm2 = prompt('لتأكيد تصفير المنصة بالكامل، اكتب كلمة "تصفير" أو "0" أدناه:');
      if (confirm2 !== 'تصفير' && confirm2 !== '0' && confirm2 !== 'reset') {
        showToast('تم إلغاء التصفير، لم يتم كتابة الكلمة الصحيحة', 'info');
        return;
      }

      try {
        const res = await fetch('index.php?action=reset_all_data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true })
        });
        const data = await res.json();
        if (data.success) {
          showToast('✅ تم تصفير المنصة بالكامل بنجاح! تم البدء من الصفر', 'success');
          try {
            const ch = new BroadcastChannel('1xwinner_sync');
            ch.postMessage({ type: 'PLATFORM_RESET' });
          } catch(e) {}
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast(data.error || 'فشلت عملية التصفير', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      }
    }

    // ========================================================
    // CLIPBOARD COPY HELPER
    // ========================================================
    function copyToClipboard(text, msg = 'تم النسخ إلى الحافظة بنجاح 📋') {
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast(msg, 'success')).catch(() => fallbackCopy(text, msg));
      } else {
        fallbackCopy(text, msg);
      }
    }

    function fallbackCopy(text, msg) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast(msg, 'success');
      } catch(e) {
        showToast('تعذر النسخ تلقائياً', 'error');
      }
      document.body.removeChild(ta);
    }

    // ========================================================
    // DEPOSITS FILTERING & VIEW TOGGLE
    // ========================================================
    let currentDepositFilter = 'all';

    function setDepositsViewMode(mode) {
      const grid = document.getElementById('deposits-grid-view');
      const table = document.getElementById('deposits-table-view');
      const btnCards = document.getElementById('dep-view-cards-btn');
      const btnTable = document.getElementById('dep-view-table-btn');

      if (mode === 'cards') {
        if (grid) grid.classList.remove('hidden');
        if (table) table.classList.add('hidden');
        if (btnCards) {
          btnCards.classList.remove('bg-[#152037]', 'text-slate-400');
          btnCards.classList.add('bg-blue-600', 'text-white', 'shadow');
        }
        if (btnTable) {
          btnTable.classList.remove('bg-blue-600', 'text-white', 'shadow');
          btnTable.classList.add('bg-[#152037]', 'text-slate-400');
        }
      } else {
        if (grid) grid.classList.add('hidden');
        if (table) table.classList.remove('hidden');
        if (btnTable) {
          btnTable.classList.remove('bg-[#152037]', 'text-slate-400');
          btnTable.classList.add('bg-blue-600', 'text-white', 'shadow');
        }
        if (btnCards) {
          btnCards.classList.remove('bg-blue-600', 'text-white', 'shadow');
          btnCards.classList.add('bg-[#152037]', 'text-slate-400');
        }
      }
    }

    function filterDepositsByStatus(status) {
      currentDepositFilter = status;
      document.querySelectorAll('.dep-filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-500', 'shadow');
        btn.classList.add('bg-[#152037]', 'text-slate-300', 'border-slate-700/60');
      });

      const activeBtn = document.getElementById(`dep-filter-${status}`);
      if (activeBtn) {
        activeBtn.classList.remove('bg-[#152037]', 'text-slate-300', 'border-slate-700/60');
        activeBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-500', 'shadow');
      }

      filterDepositsLive();
    }

    function filterDepositsLive() {
      const q = (document.getElementById('deposits-search-input')?.value || '').toLowerCase().trim();
      const cards = document.querySelectorAll('.deposit-card');
      const rows = document.querySelectorAll('.deposit-table-row');

      let visibleCount = 0;

      cards.forEach(card => {
        const cardStatus = card.getAttribute('data-status') || '';
        const cardSearch = card.getAttribute('data-search') || '';
        const matchStatus = currentDepositFilter === 'all' || cardStatus === currentDepositFilter;
        const matchSearch = !q || cardSearch.includes(q);

        if (matchStatus && matchSearch) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status') || '';
        const rowSearch = row.getAttribute('data-search') || '';
        const matchStatus = currentDepositFilter === 'all' || rowStatus === currentDepositFilter;
        const matchSearch = !q || rowSearch.includes(q);

        if (matchStatus && matchSearch) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    // ========================================================
    // WITHDRAWALS FILTERING & VIEW TOGGLE
    // ========================================================
    let currentWithdrawFilter = 'all';

    function setWithdrawsViewMode(mode) {
      const grid = document.getElementById('withdraws-grid-view');
      const table = document.getElementById('withdraws-table-view');
      const btnCards = document.getElementById('with-view-cards-btn');
      const btnTable = document.getElementById('with-view-table-btn');

      if (mode === 'cards') {
        if (grid) grid.classList.remove('hidden');
        if (table) table.classList.add('hidden');
        if (btnCards) {
          btnCards.classList.remove('bg-[#152037]', 'text-slate-400');
          btnCards.classList.add('bg-purple-600', 'text-white', 'shadow');
        }
        if (btnTable) {
          btnTable.classList.remove('bg-purple-600', 'text-white', 'shadow');
          btnTable.classList.add('bg-[#152037]', 'text-slate-400');
        }
      } else {
        if (grid) grid.classList.add('hidden');
        if (table) table.classList.remove('hidden');
        if (btnTable) {
          btnTable.classList.remove('bg-[#152037]', 'text-slate-400');
          btnTable.classList.add('bg-purple-600', 'text-white', 'shadow');
        }
        if (btnCards) {
          btnCards.classList.remove('bg-purple-600', 'text-white', 'shadow');
          btnCards.classList.add('bg-[#152037]', 'text-slate-400');
        }
      }
    }

    function filterWithdrawsByStatus(status) {
      currentWithdrawFilter = status;
      document.querySelectorAll('.with-filter-btn').forEach(btn => {
        btn.classList.remove('bg-purple-600', 'text-white', 'border-purple-500', 'shadow');
        btn.classList.add('bg-[#152037]', 'text-slate-300', 'border-slate-700/60');
      });

      const activeBtn = document.getElementById(`with-filter-${status}`);
      if (activeBtn) {
        activeBtn.classList.remove('bg-[#152037]', 'text-slate-300', 'border-slate-700/60');
        activeBtn.classList.add('bg-purple-600', 'text-white', 'border-purple-500', 'shadow');
      }

      filterWithdrawsLive();
    }

    function filterWithdrawsLive() {
      const q = (document.getElementById('withdraws-search-input')?.value || '').toLowerCase().trim();
      const cards = document.querySelectorAll('.withdraw-card');
      const rows = document.querySelectorAll('.withdraw-table-row');

      cards.forEach(card => {
        const cardStatus = card.getAttribute('data-status') || '';
        const cardSearch = card.getAttribute('data-search') || '';
        const matchStatus = currentWithdrawFilter === 'all' || cardStatus === currentWithdrawFilter;
        const matchSearch = !q || cardSearch.includes(q);

        if (matchStatus && matchSearch) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });

      rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status') || '';
        const rowSearch = row.getAttribute('data-search') || '';
        const matchStatus = currentWithdrawFilter === 'all' || rowStatus === currentWithdrawFilter;
        const matchSearch = !q || rowSearch.includes(q);

        if (matchStatus && matchSearch) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    // ========================================================
    // ADVANCED RECEIPT LIGHTBOX WITH ZOOM & ROTATE
    // ========================================================
    let currentLightboxTxId = null;
    let currentLightboxZoom = 1;
    let currentLightboxRotation = 0;
    let currentLightboxUser = null;

    function openReceiptLightbox(url, userName, uid, amount, phone, refCode, txId, status) {
      currentLightboxTxId = txId;
      currentLightboxUser = { userName, uid, amount, txId };
      currentLightboxZoom = 1;
      currentLightboxRotation = 0;

      const img = document.getElementById('lightbox-img');
      img.src = url;
      img.style.transform = 'scale(1) rotate(0deg)';

      document.getElementById('lightbox-user-badge').innerText = `${userName} (ID: ${uid})`;
      document.getElementById('lightbox-subtitle').innerText = `طلب إيداع رقم ${txId}`;
      document.getElementById('lightbox-amount').innerText = `${amount} ج.م`;
      document.getElementById('lightbox-phone').innerText = phone || 'غير محدد';
      document.getElementById('lightbox-ref').innerText = refCode || 'بدون كود';
      document.getElementById('lightbox-txid').innerText = txId;
      document.getElementById('lightbox-open-external').href = url;

      const actionsEl = document.getElementById('lightbox-actions');
      if (status === 'pending') {
        actionsEl.classList.remove('hidden');
      } else {
        actionsEl.classList.add('hidden');
      }

      document.getElementById('receipt-lightbox-modal').classList.remove('hidden');
    }

    function closeReceiptLightbox() {
      document.getElementById('receipt-lightbox-modal').classList.add('hidden');
      currentLightboxTxId = null;
    }

    function zoomLightbox(factor) {
      currentLightboxZoom = Math.max(0.4, Math.min(4, currentLightboxZoom * factor));
      updateLightboxTransform();
    }

    function rotateLightbox() {
      currentLightboxRotation = (currentLightboxRotation + 90) % 360;
      updateLightboxTransform();
    }

    function resetLightbox() {
      currentLightboxZoom = 1;
      currentLightboxRotation = 0;
      updateLightboxTransform();
    }

    function updateLightboxTransform() {
      const img = document.getElementById('lightbox-img');
      if (img) {
        img.style.transform = `scale(${currentLightboxZoom}) rotate(${currentLightboxRotation}deg)`;
      }
    }

    function openRejectFromLightbox() {
      if (!currentLightboxTxId || !currentLightboxUser) return;
      closeReceiptLightbox();
      openRejectDepositModal(currentLightboxUser.txId, currentLightboxUser.userName, currentLightboxUser.amount);
    }

    // ========================================================
    // REJECT DEPOSIT MODAL
    // ========================================================
    let targetRejectTxId = null;

    function openRejectDepositModal(txId, userName, amount) {
      targetRejectTxId = txId;
      document.getElementById('reject-user-name').innerText = userName || 'لاعب';
      document.getElementById('reject-user-amt').innerText = `${amount} ج.م`;
      document.getElementById('reject-tx-id').innerText = txId;
      document.getElementById('reject-reason-input').value = 'لم يتم استلام المبلغ على المحفظة';
      document.getElementById('reject-deposit-modal').classList.remove('hidden');
    }

    function closeRejectDepositModal() {
      document.getElementById('reject-deposit-modal').classList.add('hidden');
      targetRejectTxId = null;
    }

    function selectRejectReason(reason) {
      const input = document.getElementById('reject-reason-input');
      if (input) input.value = reason;
    }

    async function confirmRejectDeposit() {
      if (!targetRejectTxId) return;
      const reason = document.getElementById('reject-reason-input').value.trim() || 'لم يتم استلام التحويل';

      try {
        const res = await fetch('index.php?action=reject_deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId: targetRejectTxId, reason })
        });
        const data = await res.json();
        if (data.success) {
          showToast('تم رفض طلب الإيداع وإشعار اللاعب', 'info');
          closeRejectDepositModal();
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast(data.error || 'فشلت العملية', 'error');
        }
      } catch(e) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      }
    }

    // ========================================================
    // WHATSAPP-STYLE LIVE SUPPORT CHAT CONTROLLER
    // ========================================================
    window.allSupportChats = <?= json_encode($userChats) ?> || {};
    let activeChatUid = null;
    let activeChatTicketId = null;

    function selectSupportChat(uid) {
      activeChatUid = uid;
      const chat = window.allSupportChats[uid];
      if (!chat) return;

      activeChatTicketId = chat.ticketId || '';

      // 1. Highlight selected contact item
      document.querySelectorAll('.support-contact-item').forEach(el => {
        el.classList.remove('bg-[#202c33]', 'border-r-4', 'border-emerald-500');
      });
      const selectedItem = document.getElementById(`chat-item-${uid}`);
      if (selectedItem) {
        selectedItem.classList.add('bg-[#202c33]', 'border-r-4', 'border-emerald-500');
      }

      // 2. Populate Header
      document.getElementById('chat-header-name').innerText = chat.userName || 'لاعب';
      document.getElementById('chat-header-id-badge').innerText = `ID: ${uid}`;
      document.getElementById('chat-header-avatar').innerText = (chat.userName || 'ل').charAt(0).toUpperCase();

      const phoneEl = document.getElementById('chat-header-phone');
      if (chat.userPhone) {
        phoneEl.innerText = `📱 ${chat.userPhone}`;
        phoneEl.classList.remove('hidden');
      } else {
        phoneEl.innerText = '';
        phoneEl.classList.add('hidden');
      }

      const balEl = document.getElementById('chat-header-balance');
      if (chat.balance !== undefined) {
        balEl.innerText = `الرصيد: ${Number(chat.balance).toLocaleString()} ج.م`;
        balEl.classList.remove('hidden');
      }

      const onlineBadge = document.getElementById('chat-header-online-badge');
      if (chat.isOnline) {
        onlineBadge.classList.remove('hidden');
      } else {
        onlineBadge.classList.add('hidden');
      }

      document.getElementById('chat-header-actions').classList.remove('hidden');
      document.getElementById('chat-canned-responses').classList.remove('hidden');
      document.getElementById('chat-input-toolbar').classList.remove('hidden');

      // 3. Render Messages in Canvas
      renderActiveChatMessages(chat.messages || []);

      // 4. Focus input
      setTimeout(() => {
        document.getElementById('support-chat-input')?.focus();
      }, 100);
    }

    function renderActiveChatMessages(messages) {
      const container = document.getElementById('chat-messages-container');
      if (!container) return;

      if (!messages || messages.length === 0) {
        container.innerHTML = `
          <div class="flex-1 flex flex-col items-center justify-center text-center text-slate-500 gap-2">
            <span class="text-3xl">👋</span>
            <span class="text-xs font-bold text-slate-400">لا توجد رسائل سابقة مع هذا اللاعب</span>
            <span class="text-[10px] text-slate-500">اكتب رسالتك أدناه لبدء المحادثة الفورية مع اللاعب مباشرة.</span>
          </div>
        `;
        return;
      }

      let html = '';
      messages.forEach(msg => {
        const isAdmin = msg.sender === 'admin';
        const senderName = isAdmin ? 'أنت (الدعم الفني)' : (msg.senderName || 'اللاعب');
        const text = (msg.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';

        if (isAdmin) {
          // Admin bubble (WhatsApp green, aligned right/left depending on RTL)
          html += `
            <div class="flex justify-start my-1">
              <div class="max-w-[78%] sm:max-w-[65%] bg-[#005c4b] text-white rounded-2xl rounded-tr-none p-3 shadow-md border border-emerald-600/30 flex flex-col gap-1">
                <span class="text-[10px] text-emerald-200 font-bold flex items-center gap-1">
                  <span>🛡️</span>
                  <span>${senderName}</span>
                </span>
                <p class="text-xs leading-relaxed whitespace-pre-wrap">${text}</p>
                <div class="flex items-center justify-end gap-1 text-[9px] text-emerald-300/80 font-mono mt-0.5">
                  <span>${time}</span>
                  <span class="text-cyan-300">✓✓</span>
                </div>
              </div>
            </div>
          `;
        } else {
          // Player bubble (Slate dark, aligned other side)
          html += `
            <div class="flex justify-end my-1">
              <div class="max-w-[78%] sm:max-w-[65%] bg-[#202c33] text-slate-100 rounded-2xl rounded-tl-none p-3 shadow-md border border-slate-700/60 flex flex-col gap-1">
                <span class="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                  <span>👤</span>
                  <span>${senderName}</span>
                </span>
                <p class="text-xs leading-relaxed whitespace-pre-wrap">${text}</p>
                <div class="flex items-center justify-end text-[9px] text-slate-400 font-mono mt-0.5">
                  <span>${time}</span>
                </div>
              </div>
            </div>
          `;
        }
      });

      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    }

    function insertCannedResponse(text) {
      const input = document.getElementById('support-chat-input');
      if (input) {
        input.value = text;
        input.focus();
      }
    }

    async function sendSupportChatReply() {
      if (!activeChatUid) {
        showToast('يرجى اختيار لاعب أولاً من القائمة', 'info');
        return;
      }

      const input = document.getElementById('support-chat-input');
      const text = input ? input.value.trim() : '';
      if (!text) return;

      const sendBtn = document.getElementById('support-chat-send-btn');
      if (sendBtn) sendBtn.disabled = true;

      // Optimistic append
      const now = new Date();
      const tempMsg = {
        sender: 'admin',
        senderName: 'الدعم الفني',
        text: text,
        timestamp: now.toISOString()
      };

      if (window.allSupportChats[activeChatUid]) {
        if (!window.allSupportChats[activeChatUid].messages) {
          window.allSupportChats[activeChatUid].messages = [];
        }
        window.allSupportChats[activeChatUid].messages.push(tempMsg);
        renderActiveChatMessages(window.allSupportChats[activeChatUid].messages);
      }

      input.value = '';

      try {
        const res = await fetch('index.php?action=reply_support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: activeChatUid,
            ticketId: activeChatTicketId,
            text: text
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('تم إرسال الرسالة إلى اللاعب بنجاح ✅', 'success');
          // Update ticketId if newly created
          if (data.ticketId) {
            activeChatTicketId = data.ticketId;
            if (window.allSupportChats[activeChatUid]) {
              window.allSupportChats[activeChatUid].ticketId = data.ticketId;
            }
          }
        } else {
          showToast(data.error || 'تعذر إرسال الرسالة', 'error');
        }
      } catch (err) {
        showToast('خطأ في الاتصال بالخادم', 'error');
      } finally {
        if (sendBtn) sendBtn.disabled = false;
        input?.focus();
      }
    }

    function filterSupportChatsList() {
      const q = (document.getElementById('support-chat-search')?.value || '').toLowerCase().trim();
      const items = document.querySelectorAll('.support-contact-item');
      items.forEach(item => {
        const searchStr = item.getAttribute('data-search') || '';
        if (!q || searchStr.includes(q)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    }

    function quickRechargeActiveChatUser() {
      if (!activeChatUid) return;
      switchTab('recharge');
      const input = document.getElementById('recharge-user-id');
      if (input) {
        input.value = activeChatUid;
        document.getElementById('recharge-amount')?.focus();
      }
    }

    function filterDepositsForActiveChatUser() {
      if (!activeChatUid) return;
      switchTab('deposits');
      const input = document.getElementById('deposits-search-input');
      if (input) {
        input.value = activeChatUid;
        filterDepositsLive();
      }
    }

    // Auto-select first chat if available on load
    window.addEventListener('DOMContentLoaded', () => {
      const firstItem = document.querySelector('.support-contact-item');
      if (firstItem) {
        const uid = firstItem.getAttribute('data-userid');
        if (uid) selectSupportChat(uid);
      }
    });

    // View Receipt Fallback
    function viewReceipt(imgUrl) {
      document.getElementById('receipt-modal-img').src = imgUrl;
      document.getElementById('receipt-modal').classList.remove('hidden');
    }

    // ========================================================
    // LIVE BACKGROUND POLLING (تحديث فوري تلقائي كل 4 ثوانٍ)
    // ========================================================
    let lastPendingDeposits = <?= count(array_filter($depositsList, fn($x) => ($x['status'] ?? 'pending') === 'pending')) ?>;
    let lastPendingWithdraws = <?= count(array_filter($withdrawsList, fn($x) => ($x['status'] ?? 'pending') === 'pending')) ?>;
    let lastOnlineCount = <?= $onlineUsersCount ?>;

    // Audio beep for instant alert
    function playAlertSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch(e) {}
    }

    async function pollDashboardLiveData() {
      try {
        const res = await fetch('index.php?action=get_live_data');
        if (!res.ok) return;
        const live = await res.json();
        if (!live || !live.success) return;

        // 1. Update stats elements
        const onlineEl = document.getElementById('stat-online-users');
        if (onlineEl && live.onlineUsers !== undefined) {
          onlineEl.innerText = live.onlineUsers;
        }

        const totalUsersEl = document.getElementById('stat-total-users');
        if (totalUsersEl && live.totalUsers !== undefined) {
          totalUsersEl.innerText = live.totalUsers;
        }

        const pendingDepEl = document.getElementById('stat-pending-deposits');
        if (pendingDepEl && live.pendingDeposits !== undefined) {
          pendingDepEl.innerText = live.pendingDeposits;
        }

        const pendingWithEl = document.getElementById('stat-pending-withdraws');
        if (pendingWithEl && live.pendingWithdraws !== undefined) {
          pendingWithEl.innerText = live.pendingWithdraws;
        }

        // 2. Alert on new deposit
        if (live.pendingDeposits !== undefined && live.pendingDeposits > lastPendingDeposits) {
          playAlertSound();
          showToast(`🚨 تنبيه فوري: تم استلام طلب إيداع جديد من لاعب! (${live.pendingDeposits} طلبات معلقة)`, 'success');
        }

        // 3. Alert on new withdrawal
        if (live.pendingWithdraws !== undefined && live.pendingWithdraws > lastPendingWithdraws) {
          playAlertSound();
          showToast(`📤 تنبيه: وصل طلب سحب جديد من لاعب!`, 'info');
        }

        // 4. Update online count tracker
        if (live.onlineUsers !== undefined && live.onlineUsers > lastOnlineCount) {
          showToast(`🟢 لاعب متصل الآن بالمنصة! (إجمالي الأونلاين: ${live.onlineUsers})`, 'info');
        }

        lastPendingDeposits = live.pendingDeposits || 0;
        lastPendingWithdraws = live.pendingWithdraws || 0;
        lastOnlineCount = live.onlineUsers || 0;

        // 5. Update user table online badges dynamically
        if (live.users && Array.isArray(live.users)) {
          live.users.forEach(u => {
            const row = document.querySelector(`.user-row[data-uid="${u.id}"]`);
            if (row) {
              row.setAttribute('data-online', u.isOnline ? 'true' : 'false');
              const badge = row.querySelector('.online-status-badge');
              if (badge) {
                if (u.isOnline) {
                  badge.className = 'online-status-badge inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                  badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> متصل الآن';
                } else {
                  badge.className = 'online-status-badge inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700';
                  badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-500"></span> غير متصل';
                }
              }
            }
          });
        }
      } catch(e) {
        // Silent catch for background polling
      }
    }

    // Start background live polling every 4 seconds
    setInterval(pollDashboardLiveData, 4000);

    // Cross-tab broadcast listener for instant sync
    try {
      const syncChannel = new BroadcastChannel('1xwinner_sync');
      syncChannel.onmessage = (event) => {
        if (event.data && (event.data.type === 'DEPOSIT_CREATED' || event.data.type === 'USER_REGISTERED' || event.data.type === 'USER_ONLINE')) {
          pollDashboardLiveData();
        }
      };
    } catch(e) {}
  </script>
</body>
</html>
