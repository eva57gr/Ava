# Supabase Setup Guide

This guide will help you set up Supabase authentication for your AI English Tutor app.

## Prerequisites

1. A Supabase account (free tier is sufficient)
2. A Supabase project

## Step 1: Create a Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Sign in or create an account
3. Click "New project"
4. Choose your organization and enter project details
5. Wait for the project to be set up

## Step 2: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (looks like `https://your-project-id.supabase.co`)
   - **Anon/Public Key** (starts with `eyJhbGciOiJIUzI1NiIs...`)

## Step 3: Configure Environment Variables

1. Create a `.env.local` file in your project root
2. Add the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Configuration (if not already set)
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

## Step 4: Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `supabase-schema.sql` (in the project root)
4. Run the query to create the necessary tables and policies

## Step 5: Configure Authentication Settings

1. In your Supabase dashboard, go to **Authentication** > **Settings**
2. Under **Auth Settings**, configure:
   - **Site URL**: `http://localhost:3000` (for development)
   - **Redirect URLs**: Add `http://localhost:3000` for development
3. For production, update these URLs to your domain

## Step 6: Configure Email Templates (Optional)

1. Go to **Authentication** > **Email Templates**
2. Customize the email templates for:
   - Confirm signup
   - Reset password
   - Change email address

## Features Included

### Authentication Features
- ✅ User signup with email/password
- ✅ User login with email/password
- ✅ Password reset functionality
- ✅ User profile management
- ✅ Automatic session management
- ✅ Protected routes and features

### User-Specific Features
- ✅ Chat history (conversations are saved per user)
- ✅ User preferences
- ✅ Profile information

## Database Schema

The setup creates the following tables:

### `profiles`
- Stores additional user information
- Linked to Supabase auth users
- Fields: id, email, full_name, avatar_url, created_at, updated_at

### `chat_sessions`
- Stores conversation history for each user
- Fields: id, user_id, title, messages (JSONB), created_at, updated_at

## Security

- **Row Level Security (RLS)** is enabled on all tables
- Users can only access their own data
- All database operations are secured with policies

## Testing

1. Start your development server: `npm run dev`
2. Open `http://localhost:3000`
3. Click "Sign Up" to create a test account
4. Verify the email if required
5. Test login/logout functionality
6. Test the AI chat features while authenticated

## Troubleshooting

### Common Issues

1. **Environment variables not working**
   - Make sure `.env.local` is in the project root
   - Restart your development server after adding variables
   - Variable names must start with `NEXT_PUBLIC_` for client-side access

2. **Database connection errors**
   - Verify your Supabase URL and anon key are correct
   - Check that you've run the schema setup SQL
   - Ensure RLS policies are properly configured

3. **Authentication not working**
   - Check Supabase Auth settings
   - Verify redirect URLs are configured
   - Check browser console for error messages

### Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js with Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

## Production Deployment

When deploying to production:

1. Update environment variables in your hosting platform
2. Update Supabase Auth settings with production URLs
3. Consider enabling additional security features
4. Set up proper error monitoring 