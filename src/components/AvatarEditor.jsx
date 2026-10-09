import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Sheet from './ui/Sheet'
import Button from './ui/Button'
import Avatar from './ui/Avatar'
import Icon from './ui/Icon'

const SIZE = 320   // stored photo is SIZE x SIZE pixels, JPEG

// Cut the cropped square out of the image and scale it to SIZE.
async function cropToBlob(src, area) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  canvas.getContext('2d').drawImage(img, area.x, area.y, area.width, area.height, 0, 0, SIZE, SIZE)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
}

// Pick a photo, crop it to a circle with zoom, save it as the profile photo.
export default function AvatarEditor({ onClose }) {
  const { profile, userId, updateProfile } = useAuth()
  const [src, setSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const onCropComplete = useCallback((_, pixels) => setArea(pixels), [])

  function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Choose an image file (JPG, PNG or WebP).')
    if (file.size > 15 * 1024 * 1024) return setError('That image is too large. Choose one under 15 MB.')
    setError('')
    setZoom(1)
    setSrc(URL.createObjectURL(file))
  }

  // Path inside the avatars bucket from a public URL (to delete old photos).
  const pathOf = url => url?.split('/storage/v1/object/public/avatars/')[1]

  async function save() {
    setBusy(true)
    setError('')
    try {
      const blob = await cropToBlob(src, area)
      const path = `${userId}/${Date.now()}.jpg`
      const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const old = pathOf(profile.avatar_url)
      const res = await updateProfile({ avatar_url: url })
      if (res.error) throw res.error
      if (old) await supabase.storage.from('avatars').remove([old])
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save the photo.')
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto() {
    setBusy(true)
    const old = pathOf(profile.avatar_url)
    await updateProfile({ avatar_url: null })
    if (old) await supabase.storage.from('avatars').remove([old])
    setBusy(false)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Profile photo"
      footer={src
        ? <><Button variant="outline" onClick={() => setSrc(null)}>Choose another</Button><Button onClick={save} loading={busy} disabled={!area}>Save photo</Button></>
        : <Button variant="outline" onClick={onClose}>Close</Button>}>
      {src ? (
        <div className="space-y-4">
          <div className="relative h-72 sm:h-80 rounded-lg overflow-hidden bg-[#0f172a]">
            <Cropper image={src} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
              onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
          </div>
          <label className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-10">Zoom</span>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary-600" aria-label="Zoom" />
          </label>
          <p className="text-xs text-gray-500">Drag the photo to position it inside the circle.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-4 gap-4">
          <Avatar person={profile} size="xl" />
          <label className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-brand text-white text-sm font-medium cursor-pointer hover:bg-brand-hover">
            <Icon name="upload" size={16} /> {profile?.avatar_url ? 'Choose a new photo' : 'Choose a photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
          </label>
          {profile?.avatar_url && (
            <button onClick={removePhoto} disabled={busy} className="text-sm text-gray-500 hover:text-red-700">Remove photo</button>
          )}
          <p className="text-xs text-gray-500">JPG, PNG or WebP. You can crop and zoom after choosing.</p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
    </Sheet>
  )
}
