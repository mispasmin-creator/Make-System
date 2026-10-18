/**
 * Utility to resolve direct high-res images, Google Drive embeds, and view links
 */
export function getAttachmentLinks(att) {
  if (!att) {
    return {
      fileId: null,
      name: '',
      isImage: false,
      isPdf: false,
      directUrl: '',
      thumbnailUrl: '',
      embedUrl: '',
      driveUrl: '',
      localPreview: null
    };
  }

  const name = String(att.name || '');
  const type = String(att.type || '');
  const isImage = type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(name);
  const isPdf = type === 'application/pdf' || /\.pdf$/i.test(name);

  // Local base64 or blob URL (available if uploaded during current session)
  const localPreview = att.previewUrl || (att.base64Data?.startsWith('data:') ? att.base64Data : null);

  // Extract Drive File ID from any Google Drive link format
  let fileId = att.fileId;
  const rawUrl = String(att.url || att.driveUrl || '');

  if (!fileId && rawUrl) {
    const match = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                  rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                  rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) {
      fileId = match[1];
    }
  }

  if (!fileId && att.id && !att.id.startsWith('file-') && !att.id.startsWith('att-') && !att.id.startsWith('req-')) {
    fileId = att.id;
  }

  let directUrl = localPreview || rawUrl;
  let thumbnailUrl = localPreview || rawUrl;
  let embedUrl = '';
  let driveUrl = rawUrl;

  if (fileId) {
    // Google Drive direct thumbnail and embed URLs
    directUrl = localPreview || `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    thumbnailUrl = localPreview || `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
    embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    driveUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
  }

  return {
    fileId,
    name,
    isImage,
    isPdf,
    localPreview,
    directUrl,
    thumbnailUrl,
    embedUrl,
    driveUrl
  };
}
