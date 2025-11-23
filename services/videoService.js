const mux = require('../config/mux');
const VideoModel = require('../models/Video');
const fs = require('fs');
const path = require('path');

exports.uploadVideoService = async ({
  userId,
  title,
  description,
  price,
  type,
  category,
  tags,
  privacy,
  ageRestriction,
  thumbnailFile,
}) => {
  try {

    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
      },
    });

    const video = await VideoModel.create({
      userId,
      title,
      description,
      price,
      type,
      category,
      tags: (typeof tags === 'string' && tags.length > 0) ? tags.split(',').map(tag => tag.trim()) : (Array.isArray(tags) ? tags : []),
      privacy,
      ageRestriction: ageRestriction === 'true',
      thumbnailUrl: thumbnailFile ? `/uploads/${thumbnailFile.filename}` : null,
      muxUploadId: upload.id,
      status: 'uploading',
    });

    // 3. Delete local thumbnail if needed
    if (thumbnailFile) fs.unlinkSync(thumbnailFile.path);

    return {
      success: true,
      message: 'Mux upload created successfully',
      uploadUrl: upload.url,
      uploadId: upload.id,
      videoId: video.id,
    };
  } catch (err) {
    console.error('Error uploading video:', err);
    throw err;
  }
};
