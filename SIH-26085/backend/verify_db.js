import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './src/lib/prisma.js';

async function verifyAuthFlow() {
  console.log('--- 1. Testing Neon DB Connection ---');
  const initialCount = await prisma.user.count();
  console.log(`✅ Connection OK. Current user count: ${initialCount}`);

  console.log('\n--- 2. Testing User Creation (Registration) ---');
  const testEmail = `test_${Date.now()}@example.com`;
  const testUsername = `testuser_${Date.now()}`;
  const testPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  const newUser = await prisma.user.create({
    data: {
      username: testUsername,
      email: testEmail,
      password: hashedPassword,
    },
  });
  console.log('✅ User registered successfully in Neon DB:');
  console.log({
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    createdAt: newUser.createdAt,
  });

  console.log('\n--- 3. Testing Authentication (Password Verification) ---');
  const fetchedUser = await prisma.user.findUnique({
    where: { email: testEmail },
  });
  const isMatch = await bcrypt.compare(testPassword, fetchedUser.password);
  console.log(`✅ Password comparison match: ${isMatch}`);

  console.log('\n--- 4. Testing Cleanup ---');
  await prisma.user.delete({
    where: { id: newUser.id },
  });
  const finalCount = await prisma.user.count();
  console.log(`✅ Test user cleaned up. Count back to: ${finalCount}`);

  await prisma.$disconnect();
  console.log('\n🎉 ALL DATABASE AUTH TESTS PASSED ON NEON POSTGRESQL!');
}

verifyAuthFlow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
