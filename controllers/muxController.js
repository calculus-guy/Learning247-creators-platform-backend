const mux = require('../config/mux'); // <-- client instance
const Video = require('../models/Video');
const LiveClass = require('../models/LiveClass');

const endpointSecret = process.env.MUX_WEBHOOK_SECRET;

// Helper: verify & parse webhook safely
function verifyAndParseWebhook(req) {
  // req.body must be raw (Buffer/string) — route uses express.raw({ type: 'application/json' })
  if (!req.body) throw new Error('Missing raw body (ensure route uses express.raw())');

  // Pass full headers to SDK verification helper
  // The SDK expects (body, headers, secret)
  mux.webhooks.verifySignature(req.body, req.headers, endpointSecret);

  // If the above doesn't throw, signature was valid.
  // Parse raw body (Buffer) into JSON object
  return JSON.parse(req.body.toString('utf-8'));
}

exports.handleMuxWebhook = async (req, res) => {
  let event;
  try {
    event = verifyAndParseWebhook(req);
  } catch (err) {
    console.error('Mux webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const { type, data } = event;
    console.log(`[Webhook] Event Received and Verified: ${type}`);

    // Video upload events (existing)
    if (type === 'video.asset.ready' && data.upload_id && !data.live_stream_id) {
      const uploadId = data.upload_id;
      const playbackId = data.playback_ids?.[0]?.id || null;
      if (!uploadId) return res.status(400).send('Missing upload_id in payload');
      await Video.update(
        { status: 'ready', muxAssetId: data.id, muxPlaybackId: playbackId, durationSeconds: Math.floor(data.duration || 0) },
        { where: { muxUploadId: uploadId } }
      );
    }

    if (type === 'video.asset.errored' && data.upload_id && !data.live_stream_id) {
      const uploadId = data.upload_id;
      if (!uploadId) return res.status(400).send('Missing upload_id in payload');
      await Video.update({ status: 'failed' }, { where: { muxUploadId: uploadId } });
    }

    // Live stream events
    if (data.live_stream_id) {
      if (type === 'video.live_stream.active') {
        await LiveClass.update({ status: 'live' }, { where: { mux_stream_id: data.live_stream_id } });
      } else if (type === 'video.live_stream.idle' || type === 'video.live_stream.disconnected') {
        await LiveClass.update({ status: 'ended' }, { where: { mux_stream_id: data.live_stream_id } });
      } else if (type === 'video.live_stream.completed') {
        await LiveClass.update({ status: 'recorded' }, { where: { mux_stream_id: data.live_stream_id } });
      } else if (type === 'video.asset.ready' && data.live_stream_id) {
        // recording ready
        await LiveClass.update(
          {
            recording_asset_id: data.id,
            mux_playback_id: data.playback_ids?.[0]?.id || null
          },
          { where: { mux_stream_id: data.live_stream_id } }
        );
      }
    }

    return res.status(200).send('Webhook processed successfully.');
  } catch (err) {
    console.error('[Webhook] Error processing event:', err);
    return res.status(500).send('Internal server error while processing webhook.');
  }
};
