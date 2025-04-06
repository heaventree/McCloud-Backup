import { Router, Request, Response } from 'express';
import axios from 'axios';

export const authRouter = Router();

// Endpoint to exchange authorization code for tokens (Google Drive)
authRouter.post('/google/token', async (req: Request, res: Response) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${req.protocol}://${req.get('host')}/auth/google/callback`,
      grant_type: 'authorization_code'
    });
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Return the tokens to the frontend
    res.json({
      token: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange authorization code for tokens',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint to exchange authorization code for tokens (Dropbox)
authRouter.post('/dropbox/token', async (req: Request, res: Response) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('client_id', process.env.DROPBOX_CLIENT_ID || '');
    params.append('client_secret', process.env.DROPBOX_CLIENT_SECRET || '');
    params.append('redirect_uri', `${req.protocol}://${req.get('host')}/auth/dropbox/callback`);
    
    const tokenResponse = await axios.post('https://api.dropboxapi.com/oauth2/token', params);
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Return the tokens to the frontend
    res.json({
      token: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in
    });
  } catch (error) {
    console.error('Dropbox auth error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange authorization code for tokens',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint to exchange authorization code for tokens (OneDrive)
authRouter.post('/onedrive/token', async (req: Request, res: Response) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('client_id', process.env.ONEDRIVE_CLIENT_ID || '');
    params.append('client_secret', process.env.ONEDRIVE_CLIENT_SECRET || '');
    params.append('redirect_uri', `${req.protocol}://${req.get('host')}/auth/onedrive/callback`);
    
    const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params);
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Return the tokens to the frontend
    res.json({
      token: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in
    });
  } catch (error) {
    console.error('OneDrive auth error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange authorization code for tokens',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint to refresh tokens (Google Drive)
authRouter.post('/google/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  
  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    });
    
    const { access_token, expires_in } = tokenResponse.data;
    
    // Return the new access token to the frontend
    res.json({
      token: access_token,
      expiresIn: expires_in
    });
  } catch (error) {
    console.error('Google token refresh error:', error);
    res.status(500).json({ 
      error: 'Failed to refresh token',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint to refresh tokens (Dropbox)
authRouter.post('/dropbox/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  
  try {
    const params = new URLSearchParams();
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');
    params.append('client_id', process.env.DROPBOX_CLIENT_ID || '');
    params.append('client_secret', process.env.DROPBOX_CLIENT_SECRET || '');
    
    const tokenResponse = await axios.post('https://api.dropboxapi.com/oauth2/token', params);
    
    const { access_token, expires_in } = tokenResponse.data;
    
    // Return the new access token to the frontend
    res.json({
      token: access_token,
      expiresIn: expires_in
    });
  } catch (error) {
    console.error('Dropbox token refresh error:', error);
    res.status(500).json({ 
      error: 'Failed to refresh token',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint to refresh tokens (OneDrive)
authRouter.post('/onedrive/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  
  try {
    const params = new URLSearchParams();
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');
    params.append('client_id', process.env.ONEDRIVE_CLIENT_ID || '');
    params.append('client_secret', process.env.ONEDRIVE_CLIENT_SECRET || '');
    params.append('redirect_uri', `${req.protocol}://${req.get('host')}/auth/onedrive/callback`);
    
    const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params);
    
    const { access_token, expires_in } = tokenResponse.data;
    
    // Return the new access token to the frontend
    res.json({
      token: access_token,
      expiresIn: expires_in
    });
  } catch (error) {
    console.error('OneDrive token refresh error:', error);
    res.status(500).json({ 
      error: 'Failed to refresh token',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// These routes will be caught by the HTML route handler in the Express app
// and serve the client-side SPA, which will then handle these routes client-side
// /auth/google/callback
// /auth/dropbox/callback
// /auth/onedrive/callback