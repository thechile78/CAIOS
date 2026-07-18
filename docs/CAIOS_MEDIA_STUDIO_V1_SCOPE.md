# CAIOS Media Studio v1.0

## Mission
Turn raw footage into professional, review-ready social media packages while preserving human approval before publishing.

## v1 scope freeze

### Ingestion
- Accept one video or a folder of ordered clips.
- Validate supported files before processing.
- Preserve source files without modification.

### Production pipeline
1. Normalize footage.
2. Remove source audio by default for montage projects.
3. Add a locally supplied, license-approved music track.
4. Apply short automatic fades between clips.
5. Apply platform-specific crops and durations.
6. Add optional brand watermark.
7. Normalize final loudness.
8. Generate a review manifest and checklist.

### Platform packages
- Instagram Reels, Stories, and Feed
- Facebook Reels and Feed
- TikTok
- YouTube Shorts
- X video
- LinkedIn video
- Pinterest video
- Snapchat Spotlight
- Threads video

### Templates
Each brand template may define:
- logo/watermark
- intro and outro assets
- type treatment
- title-safe zones
- CTA copy
- music category
- transition intensity

Initial brand profiles:
- Chilemaniacs
- The Chile Promotions
- Boxing Promotions
- Neutral/Unbranded

### Discoverability package
Each production job reserves metadata fields for:
- SEO title
- short caption
- long caption
- hashtags
- thumbnail text
- alt text
- CTA
- source and music-license notes

### Safety gates
- No automatic social publishing in v1.
- Every output must remain in `Review` until approved by The Chile.
- Music must come from an approved local library and include a license/source record.
- Employer-owned branding must be isolated from personal brands.

## Acceptance criteria
v1 is accepted when one command can process a folder of clips plus an approved music file and create validated outputs for the configured platform profiles, with a review manifest and no upload or publishing action.

## Deferred beyond v1
- Direct platform publishing
- Trend scraping
- Performance-learning automation
- AI-generated B-roll
- Cloud rendering
- Team permissions
- Fully autonomous editorial decisions
