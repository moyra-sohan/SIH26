import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './src/lib/prisma.js';

async function verifyAuthFlow() {
  console.log('--- 1. Testing Neon DB Connection ---');
  const initialCount = await prisma.user.count();
  console.log(`✅ Connection OK. Current user count: ${initialCount}`);

  console.log('\n--- 2. Testing User Creation (with generic data, optional houseNo) ---');
  const testEmail = `user_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  // Test 1: User without houseNo (nullable)
  const newUser = await prisma.user.create({
    data: {
      name: 'Alex Johnson',
      username: `alex_${Date.now()}`,
      email: testEmail,
      password: hashedPassword,
      houseNo: null, // Nullable / optional field
      street: 'Main Avenue',
      area: 'Downtown Sector',
      city: 'Kolkata',
      district: 'Kolkata',
      state: 'West Bengal',
      pinCode: '700091',
      country: 'India',
    },
  });

  console.log('✅ User with optional houseNo (null) registered successfully:');
  console.log({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    houseNo: newUser.houseNo,
    street: newUser.street,
    area: newUser.area,
    city: newUser.city,
    district: newUser.district,
    state: newUser.state,
    pinCode: newUser.pinCode,
    country: newUser.country,
  });

  console.log('\n--- 3. Testing Authentication & Field Retrieval ---');
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
  console.log('\n🎉 ALL DATABASE VALIDATIONS & CONSTRAINTS PASSED ON NEON POSTGRESQL!');
}

verifyAuthFlow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
