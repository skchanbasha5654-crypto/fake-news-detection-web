import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';

const credentials = z.object({ name: z.string().trim().min(2).max(80).optional(), email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(100) });
const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const safeUser = (user) => ({ id: user._id, name: user.name, email: user.email });
const parseCredentials = (body, includeName) => {
  const result = (includeName ? credentials : credentials.omit({ name: true })).safeParse(body);
  if (!result.success) return { error: result.error.issues[0]?.message || 'Invalid request' };
  return { data: result.data };
};

export async function register(req, res) {
  const parsed = parseCredentials(req.body, true);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const data = parsed.data;
  if (!data.name) return res.status(400).json({ message: 'Name is required' });
  if (await User.exists({ email: data.email })) return res.status(409).json({ message: 'An account with that email already exists' });
  const user = await User.create({ ...data, password: await bcrypt.hash(data.password, 12) });
  res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
}
export async function login(req, res) {
  const parsed = parseCredentials(req.body, false);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const data = parsed.data;
  const user = await User.findOne({ email: data.email }).select('+password');
  if (!user || !(await bcrypt.compare(data.password, user.password))) return res.status(401).json({ message: 'Invalid email or password' });
  res.json({ token: tokenFor(user), user: safeUser(user) });
}
