import { db } from './index';
import { settings } from './schema';
import { user, account } from '../../auth-schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { auth } from '../lib/auth.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // Delete existing admin if any
  await db.delete(user).where(eq(user.email, 'admin@ccpiano.ie'));
  
  // Use Better Auth's signup API to create the admin user with proper password hashing
  try {
    await auth.api.signUpEmail({
      body: {
        email: 'admin@ccpiano.ie',
        password: 'Hello@123',
        name: 'Admin User',
      }
    });
    
    // Update the user's role to admin
    await db.update(user)
      .set({ role: 'admin' })
      .where(eq(user.email, 'admin@ccpiano.ie'));
    
    console.log('✓ Admin user created:', {
      email: 'admin@ccpiano.ie',
      password: 'Hello@123',
      role: 'admin',
    });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✓ Admin user already exists');
    } else {
      throw error;
    }
  }

  // Check if theme setting exists
  const existingTheme = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'theme'))
    .limit(1);

  if (existingTheme.length > 0) {
    console.log('✓ Theme setting already exists');
  } else {
    // Create default theme setting
    await db.insert(settings).values({
      key: 'theme',
      value: 'default',
    });

    console.log('✓ Default theme setting created');
  }

  console.log('🎉 Seeding complete!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
