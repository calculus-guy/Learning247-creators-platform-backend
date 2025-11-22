const Mux = require("@mux/mux-node");
const { Webhooks } = Mux;
const Video = require('../models/Video');
const LiveClass = require('../models/liveClass');

const endpointSecret = process.env.MUX_WEBHOOK_SECRET;

exports.handleMuxWebhook = async (req, res) => {
  let event;

  // 1. Get signature header
  const signature = req.get('Mux-Signature') || req.get('mux-signature');
  if (!signature) {
    console.warn('[Webhook] Missing Mux signature header.');
    return res.status(400).json({ error: 'Missing Mux signature header' });
  }

  try {
    event = Webhooks.verifySignature(req.body, req.headers, endpointSecret);

    console.log("[Webhook] Verified Event:", event.type);

  } catch (err) {
    console.error("Mux webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 3. Extract event information
  const { type, data } = event;

  try {
    // ---------------- VIDEO UPLOAD EVENTS ----------------
    if (type === "video.asset.ready" && data.upload_id && !data.live_stream_id) {
      const playbackId = data.playback_ids?.[0]?.id || null;

      await Video.update(
        {
          status: "ready",
          muxAssetId: data.id,
          muxPlaybackId: playbackId,
          durationSeconds: Math.floor(data.duration || 0),
        },
        { where: { muxUploadId: data.upload_id } }
      );
    }

    if (type === "video.asset.errored" && data.upload_id && !data.live_stream_id) {
      await Video.update(
        { status: "failed" },
        { where: { muxUploadId: data.upload_id } }
      );
    }

    // ---------------- LIVE STREAM EVENTS ----------------
    if (data.live_stream_id) {
      if (type === "video.live_stream.active") {
        await LiveClass.update(
          { status: "live" },
          { where: { mux_stream_id: data.live_stream_id } }
        );
      }

      if (type === "video.live_stream.idle") {
        await LiveClass.update(
          { status: "ended" },
          { where: { mux_stream_id: data.live_stream_id } }
        );
      }

      if (type === "video.live_stream.completed") {
        await LiveClass.update(
          { status: "recorded" },
          { where: { mux_stream_id: data.live_stream_id } }
        );
      }

      if (type === "video.asset.ready") {
        await LiveClass.update(
          {
            recording_asset_id: data.id,
            mux_playback_id: data.playback_ids?.[0]?.id || null,
          },
          { where: { mux_stream_id: data.live_stream_id } }
        );
      }
    }

    return res.status(200).send("Webhook processed successfully.");

  } catch (err) {
    console.error("[Webhook] Error processing event:", err);
    return res.status(500).send("Internal server error while processing webhook.");
  }
};
