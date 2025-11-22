const { Webhooks } = require("@mux/mux-node");
const Video = require('../models/Video');
const LiveClass = require('../models/liveClass');

const endpointSecret = process.env.MUX_WEBHOOK_SECRET;

exports.handleMuxWebhook = async (req, res) => {
  const signature = req.get('Mux-Signature') || req.get('mux-signature');

  if (!signature) {
    console.warn('[Webhook] Missing Mux signature header.');
    return res.status(400).json({ error: 'Missing Mux signature header' });
  }

  let event;
  try {
    // Create Webhooks instance and verify signature
    // verifySignature expects: (body as string, headers object, secret)
    const webhooks = new Webhooks(endpointSecret);
    const bodyString = typeof req.body === 'string' ? req.body : req.body.toString('utf-8');
    webhooks.verifySignature(bodyString, req.headers, endpointSecret);

    event = JSON.parse(bodyString);

  } catch (err) {
    console.error('Mux webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const { type, data } = event;

    console.log(`[Webhook] Event Received and Verified: ${type}`);

    // Video Upload Asset Events (legacy, keep unchanged)
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
    // LIVE STREAM EVENTS
    if (data.live_stream_id) {
      // 1. Live Stream Started
      if (type === 'video.live_stream.active') {
        await LiveClass.update({ status: 'live' }, { where: { mux_stream_id: data.live_stream_id } });
      } else if (type === 'video.live_stream.idle') {
        await LiveClass.update({ status: 'ended' }, { where: { mux_stream_id: data.live_stream_id } });
      } else if (type === 'video.live_stream.completed') {
        await LiveClass.update({ status: 'recorded' }, { where: { mux_stream_id: data.live_stream_id } });
      } else if (type === 'video.asset.ready' && data.live_stream_id) {
        // Recording for live completed
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