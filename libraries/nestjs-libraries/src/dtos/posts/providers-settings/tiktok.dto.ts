import {
  IsBoolean, ValidateIf, IsIn, IsString, MaxLength, IsOptional, IsDefined, IsNumber, Min, Max, ValidateNested,
  ValidateBy, ValidationArguments
} from 'class-validator';
import { Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';

// Direct Post audit rules (TikTok Content Sharing Guidelines), checked only on
// DIRECT_POST so UPLOAD and existing API clients are unaffected.
const isDirectPost = (o: any) => o?.content_posting_method !== 'UPLOAD';

// "Disclose video content" on: the user must say whether the post promotes
// their own brand, a third party, or both.
function DisclosureNeedsAChoice() {
  return ValidateBy({
    name: 'tiktokDisclosureNeedsAChoice',
    validator: {
      validate: (value: any, args?: ValidationArguments) => {
        const o = args?.object as any;
        return !(
          isDirectPost(o) &&
          value === true &&
          !o?.brand_content_toggle &&
          !o?.brand_organic_toggle
        );
      },
      defaultMessage: () =>
        'You need to indicate if your content promotes yourself, a third party, or both.',
    },
  });
}

// Branded content cannot be private ("Self only").
function BrandedContentNotPrivate() {
  return ValidateBy({
    name: 'tiktokBrandedContentNotPrivate',
    validator: {
      validate: (value: any, args?: ValidationArguments) => {
        const o = args?.object as any;
        return !(isDirectPost(o) && value === true && o?.privacy_level === 'SELF_ONLY');
      },
      defaultMessage: () =>
        'Branded content visibility cannot be set to "Self only".',
    },
  });
}

// Set by the composer when the video is longer than creator_info's
// max_video_post_duration_sec.
function NotTooLong() {
  return ValidateBy({
    name: 'tiktokVideoNotTooLong',
    validator: {
      validate: (value: any, args?: ValidationArguments) =>
        !(isDirectPost(args?.object) && value === true),
      defaultMessage: () =>
        'This video is longer than the maximum duration allowed for this TikTok account.',
    },
  });
}

export class TikTokMusic {
  @IsDefined()
  @IsString()
  @JSONSchema({
    description:
      'The commercial music library track id, taken from the "id" returned by the musicSearch function.',
  })
  id: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  artist?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  audio_volume?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  video_volume?: number;
}

export class TikTokLocation {
  @IsDefined()
  @IsString()
  @JSONSchema({
    description:
      'The location tag id, taken from the "id" returned by the locationSearch function.',
  })
  id: string;

  @IsDefined()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;
}

// TikTok only honors most of these settings on a DIRECT_POST. With
// content_posting_method=UPLOAD the media lands in the user's TikTok inbox as a
// draft, and TikTok's inbox/upload endpoints accept nothing but the title /
// description - every other field below is silently discarded.
// video_made_with_ai / duet / stitch are additionally video-only: TikTok's photo
// post_info has no is_aigc, disable_duet or disable_stitch field.
// music / location are TikTok Business only: the legacy TikTok provider ignores
// them (its Content Posting API has no music_sound_info / location fields).
// Fields stay required here (existing clients depend on it); the constraints are
// documented, not enforced. Exceptions, for TikTok's Direct Post audit:
// privacy_level is only required on DIRECT_POST (the user must pick it
// manually, nothing is preselected, so UPLOAD posts must not be blocked by an
// empty value), and the optional disclose / video_too_long flags plus the
// branded-content rule are only checked on DIRECT_POST.
export class TikTokDto {
  @ValidateIf((p) => p.title)
  @MaxLength(90)
  @JSONSchema({
    description:
      'Used as the title of the post. The only setting TikTok keeps when content_posting_method=UPLOAD.',
  })
  title: string;

  @ValidateIf((p) => p.content_posting_method !== 'UPLOAD')
  @IsIn([
    'PUBLIC_TO_EVERYONE',
    'MUTUAL_FOLLOW_FRIENDS',
    'FOLLOWER_OF_CREATOR',
    'SELF_ONLY',
  ])
  @IsString()
  @JSONSchema({
    description:
      'Required when content_posting_method=DIRECT_POST; must be chosen explicitly by the user (TikTok forbids preselecting it) among the privacy_level_options of creator_info. Ignored by TikTok on UPLOAD.',
  })
  privacy_level:
    | 'PUBLIC_TO_EVERYONE'
    | 'MUTUAL_FOLLOW_FRIENDS'
    | 'FOLLOWER_OF_CREATOR'
    | 'SELF_ONLY';

  @IsBoolean()
  @JSONSchema({
    description:
      'Video posts only, and only when content_posting_method=DIRECT_POST. TikTok has no duet setting for photo posts.',
  })
  duet: boolean;

  @IsBoolean()
  @JSONSchema({
    description:
      'Video posts only, and only when content_posting_method=DIRECT_POST. TikTok has no stitch setting for photo posts.',
  })
  stitch: boolean;

  @IsBoolean()
  @JSONSchema({
    description:
      'Applied only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD.',
  })
  comment: boolean;

  @IsIn(['yes', 'no'])
  @JSONSchema({
    description:
      'Photo posts only, and only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD. ' +
      'On TikTok Business, "yes" attaches a random commercial music library track and overrides the music setting; ' +
      'on legacy TikTok, "yes" lets TikTok auto-add its recommended music.',
  })
  autoAddMusic: 'yes' | 'no';

  @IsBoolean()
  @BrandedContentNotPrivate()
  @JSONSchema({
    description:
      'Applied only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD. Cannot be true with privacy_level=SELF_ONLY.',
  })
  brand_content_toggle: boolean;

  @IsOptional()
  @IsBoolean()
  @DisclosureNeedsAChoice()
  @JSONSchema({
    description:
      'Optional. "Disclose video content" switch of the composer: when true on DIRECT_POST, brand_organic_toggle or brand_content_toggle must be true.',
  })
  disclose?: boolean;

  @IsOptional()
  @IsBoolean()
  @NotTooLong()
  @JSONSchema({
    description:
      'Optional, set by the composer: true when the video is longer than the account max_video_post_duration_sec (blocks DIRECT_POST).',
  })
  video_too_long?: boolean;

  @IsBoolean()
  @IsOptional()
  @JSONSchema({
    description:
      'Labels the post as AI generated. Video posts only, and only when content_posting_method=DIRECT_POST. TikTok has no AI-generated label for photo posts, and discards it on UPLOAD.',
  })
  video_made_with_ai: boolean;

  @IsBoolean()
  @JSONSchema({
    description:
      'Applied only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD.',
  })
  brand_organic_toggle: boolean;

  @Type(() => TikTokMusic)
  @ValidateNested()
  @IsOptional()
  @JSONSchema({
    description:
      'TikTok Business only, and only when content_posting_method=DIRECT_POST. Attaches a commercial music library track to the post (use the musicSearch function to find one). audio_volume / video_volume apply to video posts only. For photos, ignored when autoAddMusic is "yes" (a random track is attached instead).',
  })
  music?: TikTokMusic;

  @Type(() => TikTokLocation)
  @ValidateNested()
  @IsOptional()
  @JSONSchema({
    description:
      'TikTok Business only, and only when content_posting_method=DIRECT_POST. Tags the post with a location (use the locationSearch function to find one).',
  })
  location?: TikTokLocation;

  @IsIn(['DIRECT_POST', 'UPLOAD'])
  @IsString()
  @JSONSchema({
    description:
      'Required. Use "DIRECT_POST" to actually publish the post to TikTok. ' +
      '"UPLOAD" does NOT publish: it only sends the media to the user\'s TikTok app inbox, ' +
      'where they must manually finish and publish it within 24 hours or it is discarded, ' +
      'and it makes TikTok ignore every other setting here. ' +
      'Only use "UPLOAD" when the user explicitly asks to review or edit the post inside the TikTok app before publishing.',
  })
  content_posting_method: 'DIRECT_POST' | 'UPLOAD';
}
