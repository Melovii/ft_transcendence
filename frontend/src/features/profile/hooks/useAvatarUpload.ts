/**
 * Profile photo flow: pick, crop, preview, upload.
 *
 *   IDLE -> (pick) -> CROPPING -> (confirm) -> UPLOADING -> IDLE
 *                         |                        |
 *                     (cancel)               (failure) -> CROPPING with an error
 *
 * Picking again while cropping replaces the photo. File type and size are prechecked
 * so the user gets feedback before any upload; `INVALID_IMAGE` from the server maps to
 * the same message.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError } from '@shared/api';

import { uploadAvatar } from '../api';
import { checkAvatarFile, exportAvatar, initialCrop, panCrop, zoomCrop } from '../model/avatarCrop';
import type { CropState, ImageSize } from '../model/avatarCrop';

/** Why a photo was not used; each is a `settings.avatar.error.*` message. */
export type AvatarError = 'INVALID_TYPE' | 'TOO_LARGE' | 'UNREADABLE' | 'UPLOAD_FAILED';

interface Editing {
  source: HTMLImageElement & ImageSize;
  sourceUrl: string;
  crop: CropState;
}

export function useAvatarUpload(viewport: number, onUploaded: (avatarUrl: string) => void) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<AvatarError | null>(null);
  const busy = useRef(false);

  useEffect(
    () => () => {
      if (editing) URL.revokeObjectURL(editing.sourceUrl);
    },
    [editing],
  );

  const pick = useCallback(
    async (file: File) => {
      const problem = checkAvatarFile(file);
      if (problem) {
        setError(problem);
        return;
      }
      const sourceUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = sourceUrl;
      try {
        await image.decode();
      } catch {
        URL.revokeObjectURL(sourceUrl);
        setError('UNREADABLE');
        return;
      }
      const source = Object.assign(image, {
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      setError(null);
      setEditing({ source, sourceUrl, crop: initialCrop(source, viewport) });
    },
    [viewport],
  );

  const zoom = useCallback(
    (value: number) =>
      setEditing((e) => e && { ...e, crop: zoomCrop(e.source, viewport, e.crop, value) }),
    [viewport],
  );

  const pan = useCallback(
    (dx: number, dy: number) =>
      setEditing((e) => e && { ...e, crop: panCrop(e.source, viewport, e.crop, dx, dy) }),
    [viewport],
  );

  const cancel = useCallback(() => {
    setEditing(null);
    setError(null);
  }, []);

  // One SAVE PHOTO sends one upload, however quickly it is pressed again.
  const confirm = useCallback(async () => {
    if (!editing || busy.current) return;
    busy.current = true;
    setUploading(true);
    setError(null);
    try {
      const file = await exportAvatar(editing.source, viewport, editing.crop);
      const { avatar_url: avatarUrl } = await uploadAvatar(file);
      setEditing(null);
      onUploaded(avatarUrl);
    } catch (cause) {
      setError((cause as ApiError).code === 'INVALID_IMAGE' ? 'INVALID_TYPE' : 'UPLOAD_FAILED');
    } finally {
      busy.current = false;
      setUploading(false);
    }
  }, [editing, onUploaded, viewport]);

  return {
    status: uploading ? 'UPLOADING' : editing ? 'CROPPING' : 'IDLE',
    error,
    /** Object URL and crop for the preview; the preview renders the image with `crop`. */
    preview: editing && { src: editing.sourceUrl, image: editing.source, crop: editing.crop },
    pick,
    zoom,
    pan,
    cancel,
    confirm,
  } as const;
}
