# Migration Guide: HTML to Next.js

This document outlines the migration from the original HTML/CSS/JS application to Next.js with TypeScript and Tailwind CSS.

## Changes Made

### Architecture
- **Before**: Single `index.html` file with inline CSS and JavaScript
- **After**: Next.js 14 App Router with TypeScript components

### File Structure
- **Before**: 
  - `index.html` (everything in one file)
  - `pcm-processor.js` (AudioWorklet processor)
  - `main.py` (Python backend)

- **After**:
  - `app/` - Next.js app directory
    - `layout.tsx` - Root layout with fonts
    - `page.tsx` - Main page component
    - `globals.css` - Global styles
  - `components/` - React components
    - `Header.tsx`
    - `Hero.tsx`
    - `MainContent.tsx`
    - `Features.tsx`
    - `Demo.tsx`
    - `Footer.tsx`
  - `hooks/` - Custom React hooks
    - `useAudioWebSocket.ts` - WebSocket and audio handling
  - `public/` - Static files
    - `pcm-processor.js` - AudioWorklet processor (unchanged)

### Key Improvements

1. **Type Safety**: Full TypeScript support with proper types
2. **Component-Based**: Modular React components for better maintainability
3. **Custom Hooks**: Audio/WebSocket logic extracted to reusable hook
4. **Tailwind CSS**: Utility-first CSS matching the original design exactly
5. **Better State Management**: React state hooks instead of global variables

### Functionality Preserved

✅ All original functionality is preserved:
- PDF upload and preview
- Voice recording and playback
- WebSocket connection with retry logic
- Audio processing with AudioWorklet
- Chat message display
- All UI elements and design

### Design Preservation

The design has been preserved exactly using Tailwind CSS:
- Same gradient colors (`#4a00e0` to `#8e2de2`)
- Same layout and spacing
- Same button styles and hover effects
- Same card shadows and borders
- Same typography (Inter font)

### Backend Compatibility

The backend (`main.py`) remains unchanged and fully compatible. No changes needed to the Python WebSocket server.

### Environment Variables

- Frontend: `NEXT_PUBLIC_WS_URL` (optional, defaults to production)
- Backend: `GOOGLE_API_KEY` (unchanged)

### Removed Features

- API key input field (was present in HTML but not actively used in WebSocket connection)
- Can be re-added if needed for client-side API key handling

### Next Steps

1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Backend remains the same: `python main.py`
4. Deploy frontend to Vercel/Netlify
5. Deploy backend to Render/Railway (unchanged)

## Notes

- Original `index.html` is preserved for reference
- All original functionality has been migrated
- TypeScript types are properly defined
- Code is more maintainable and follows React best practices
