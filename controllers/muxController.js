const Mux = require('@mux/mux-node');
const Video = require('../models/Video');

const endpointSecret = process.env.MUX_WEBHOOK_SECRET;

exports.handleMuxWebhook = async (req, res) => {
  const signature = req.get('Mux-Signature') || req.get('mux-signature');

  if (!signature) {
    console.warn('[Webhook] Missing Mux signature header.');
    return res.status(400).json({ error: 'Missing Mux signature header' });
  }

  let event;
  try {
    Mux.Webhooks.verifySignature(req.body, signature, endpointSecret);

    event = JSON.parse(req.body.toString('utf-8'));

  } catch (err) {
    console.error('Mux webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const { type, data } = event;

    console.log(`[Webhook] Event Received and Verified: ${type}`);

    if (type === 'video.asset.ready') {
      const uploadId = data.upload_id; // Mux uses snake_case
      const playbackId = data.playback_ids?.[0]?.id || null;

      if (!uploadId) {
        console.error('[Webhook] Error: "upload_id" is missing from the "video.asset.ready" event payload.');
        return res.status(400).send('Missing upload_id in payload');
      }

      const [updatedCount] = await Video.update(
        {
          status: 'ready',
          muxAssetId: data.id,
          muxPlaybackId: playbackId,
          durationSeconds: Math.floor(data.duration || 0)
        },
        { where: { muxUploadId: uploadId } }
      );

      if (updatedCount === 0) {
        console.warn(`[Webhook] No video row found to update for muxUploadId: ${uploadId}`);
      } else {
        console.log(`[Webhook] Success: Video marked as ready for muxUploadId: ${uploadId}`);
      }
    }

    if (type === 'video.asset.errored') {
      const uploadId = data.upload_id;
       if (!uploadId) {
        console.error('[Webhook] Error: "upload_id" is missing from the "video.asset.errored" event payload.');
        return res.status(400).send('Missing upload_id in payload');
      }
      await Video.update(
        { status: 'failed' },
        { where: { muxUploadId: uploadId } }
      );
      console.log(`[Webhook] Video processing failed for muxUploadId: ${uploadId}`);
    }

    return res.status(200).send('Webhook processed successfully.');
  } catch (err) {
    console.error('[Webhook] Error processing event:', err);
    return res.status(500).send('Internal server error while processing webhook.');
  }
};