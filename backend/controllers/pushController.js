// backend/controllers/pushController.js
const { asyncHandler } = require("./_helpers");
const { webPushService } = require("../services/webPushService");

exports.getPublicKey = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { publicKey: webPushService.publicKey() } });
});

exports.subscribe = asyncHandler(async (req, res) => {
  await webPushService.saveSubscription({
    userId: req.user?.id,
    subscription: req.body,
  });
  res.json({ success: true, message: "Notifikasi push diaktifkan" });
});

exports.unsubscribe = asyncHandler(async (req, res) => {
  await webPushService.removeSubscription(req.body?.endpoint);
  res.json({ success: true, message: "Notifikasi push dinonaktifkan" });
});
