import unittest

from backend.identity import hash_password, validate_registration_username, verify_password


class IdentityRulesTests(unittest.TestCase):
    def test_registration_username_accepts_letters_only(self):
        self.assertEqual(validate_registration_username("MiaUser"), "miauser")

    def test_registration_username_rejects_non_letters(self):
        for value in ("mi", "mia_user", "mia-user", "mia7", "Mia User", "a" * 33):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    validate_registration_username(value)

    def test_password_requires_exactly_six_digits(self):
        for value in ("12345", "1234567", "12345a", "abcdef"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    hash_password(value)

        encoded = hash_password("123456")
        self.assertTrue(verify_password("123456", encoded))


if __name__ == "__main__":
    unittest.main()
