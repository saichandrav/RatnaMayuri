# Cloudinary Image Storage Setup

Your RatnaMayuri backend has been migrated to use **Cloudinary** for image storage instead of MongoDB. This reduces database size and improves image delivery with CDN.

## Setup Steps

### 1. Create a Cloudinary Account
1. Sign up for free at [cloudinary.com](https://cloudinary.com)
2. Log into your Cloudinary dashboard

### 2. Get API Credentials
In your Cloudinary account:
- Navigate to **Settings** → **API Keys**
- Copy your:
  - **Cloud Name**
  - **API Key**
  - **API Secret**

### 3. Update Environment Variables

**Option 1: Use CLOUDINARY_URL (Recommended)**
Add this single line to your `.env` file:
```
CLOUDINARY_URL=cloudinary://your_api_key:your_api_secret@your_cloud_name
```

Replace:
- `your_api_key` - Your Cloudinary API Key
- `your_api_secret` - Your Cloudinary API Secret
- `your_cloud_name` - Your Cloud Name

Example:
```
CLOUDINARY_URL=cloudinary://abc123:xyz789@drsldo8le
```

**Option 2: Use Individual Variables (Fallback)**
If you prefer separate variables, add these to your `.env` file:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Restart Backend
```bash
npm run dev
# or
npm start
```

## How It Works

- **Upload Flow**: Seller uploads image → Multer reads file → Cloudinary stores image → Metadata saved to MongoDB
- **Image URL**: Returns direct Cloudinary CDN URL (fast, cached globally)
- **Storage**: Metadata only in MongoDB (filename, originalName, cloudinary IDs)
- **Serving**: Images are fetched directly from Cloudinary CDN, bypassing your server

## Benefits

✓ Database stays lightweight (no binary in MongoDB)
✓ Images served from CDN (global edge locations)
✓ Easier to scale (images independent of server)
✓ Free tier: 25 GB monthly storage
