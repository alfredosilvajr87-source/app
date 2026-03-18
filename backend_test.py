import requests
import sys
import json
from datetime import datetime, timedelta

class LacucinaAPITester:
    def __init__(self, base_url="https://purchase-hub-32.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.user_id = None
        self.unit_id = None
        self.section_ids = {}
        self.item_ids = {}
        self.order_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_auth_flow(self):
        """Test authentication flow"""
        print("\n🔐 Testing Authentication Flow...")
        
        # Test user registration
        test_user = {
            "email": "test@lacucina.com",
            "password": "test123456",
            "name": "Test Chef"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
        
        # Test user login
        login_data = {
            "email": test_user["email"],
            "password": test_user["password"]
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
        
        # Test get user info
        self.run_test(
            "Get User Info",
            "GET",
            "auth/me",
            200
        )

    def test_units_crud(self):
        """Test Units CRUD operations"""
        print("\n🏢 Testing Units CRUD...")
        
        # Create unit
        unit_data = {
            "name": "Main Kitchen",
            "address": "123 Chef Street, Culinary City"
        }
        
        success, response = self.run_test(
            "Create Unit",
            "POST",
            "units",
            200,
            data=unit_data
        )
        
        if success and 'id' in response:
            self.unit_id = response['id']
        
        # List units
        self.run_test(
            "List Units",
            "GET",
            "units",
            200
        )
        
        # Update unit
        if self.unit_id:
            update_data = {
                "name": "Updated Main Kitchen",
                "address": "456 Updated Street"
            }
            self.run_test(
                "Update Unit",
                "PUT",
                f"units/{self.unit_id}",
                200,
                data=update_data
            )

    def test_sections_crud(self):
        """Test Sections CRUD operations"""
        print("\n📦 Testing Sections CRUD...")
        
        # Seed data first to get sections
        self.run_test(
            "Seed Initial Data",
            "POST",
            "seed",
            200
        )
        
        # List sections
        success, response = self.run_test(
            "List Sections",
            "GET",
            "sections",
            200
        )
        
        if success and response:
            for section in response:
                self.section_ids[section['name']] = section['id']
        
        # Create new section
        section_data = {
            "name": "Test Section",
            "description": "Test section for API testing",
            "icon": "TestIcon"
        }
        
        success, response = self.run_test(
            "Create Section",
            "POST",
            "sections",
            200,
            data=section_data
        )
        
        if success and 'id' in response:
            test_section_id = response['id']
            
            # Update section
            update_data = {
                "name": "Updated Test Section",
                "description": "Updated description",
                "icon": "UpdatedIcon"
            }
            self.run_test(
                "Update Section",
                "PUT",
                f"sections/{test_section_id}",
                200,
                data=update_data
            )

    def test_items_crud(self):
        """Test Items CRUD operations"""
        print("\n🥘 Testing Items CRUD...")
        
        # List items
        success, response = self.run_test(
            "List Items",
            "GET",
            "items",
            200
        )
        
        if success and response:
            for item in response:
                self.item_ids[item['name']] = item['id']
        
        # Create new item
        if self.section_ids:
            section_id = list(self.section_ids.values())[0]
            item_data = {
                "name": "Test Item",
                "section_id": section_id,
                "unit_of_measure": "kg",
                "minimum_stock": 5.0,
                "average_consumption": 2.0
            }
            
            success, response = self.run_test(
                "Create Item",
                "POST",
                "items",
                200,
                data=item_data
            )
            
            if success and 'id' in response:
                test_item_id = response['id']
                
                # Update item
                update_data = {
                    "name": "Updated Test Item",
                    "section_id": section_id,
                    "unit_of_measure": "l",
                    "minimum_stock": 10.0,
                    "average_consumption": 3.0
                }
                self.run_test(
                    "Update Item",
                    "PUT",
                    f"items/{test_item_id}",
                    200,
                    data=update_data
                )

    def test_safety_stock(self):
        """Test Safety Stock configuration"""
        print("\n🛡️ Testing Safety Stock...")
        
        if not self.unit_id:
            self.log_test("Safety Stock - No Unit", False, "No unit available for testing")
            return
        
        # Get safety stock settings
        self.run_test(
            "Get Safety Stock Settings",
            "GET",
            f"safety-stock/{self.unit_id}",
            200
        )
        
        # Update safety stock settings
        safety_configs = []
        for day in range(7):
            safety_configs.append({
                "day_of_week": day,
                "percentage": 25 if day in [4, 5] else 15,  # Higher on weekends
                "enabled": True
            })
        
        self.run_test(
            "Update Safety Stock Settings",
            "PUT",
            f"safety-stock/{self.unit_id}",
            200,
            data=safety_configs
        )

    def test_stock_entries(self):
        """Test Stock Entries"""
        print("\n📊 Testing Stock Entries...")
        
        if not self.unit_id or not self.item_ids:
            self.log_test("Stock Entries - Missing Data", False, "No unit or items available")
            return
        
        # Create stock entries
        entries = []
        for item_name, item_id in list(self.item_ids.items())[:3]:  # Test with first 3 items
            entries.append({
                "item_id": item_id,
                "quantity": 15.5,
                "unit_id": self.unit_id
            })
        
        self.run_test(
            "Create Stock Entries",
            "POST",
            "stock-entries",
            200,
            data=entries
        )
        
        # Get stock entries
        self.run_test(
            "Get Stock Entries",
            "GET",
            f"stock-entries/{self.unit_id}",
            200
        )
        
        # Get latest stock entries
        self.run_test(
            "Get Latest Stock Entries",
            "GET",
            f"stock-entries/{self.unit_id}/latest",
            200
        )

    def test_orders(self):
        """Test Orders functionality"""
        print("\n🛒 Testing Orders...")
        
        if not self.unit_id:
            self.log_test("Orders - No Unit", False, "No unit available for testing")
            return
        
        # Calculate order for target date
        target_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        success, response = self.run_test(
            "Calculate Order",
            "GET",
            f"orders/{self.unit_id}/calculate?target_date={target_date}",
            200
        )
        
        # Create order
        if success and 'items' in response and response['items']:
            order_data = {
                "unit_id": self.unit_id,
                "target_date": target_date,
                "items": response['items'][:3],  # Use first 3 items
                "notes": "Test order from API testing"
            }
            
            success, order_response = self.run_test(
                "Create Order",
                "POST",
                "orders",
                200,
                data=order_data
            )
            
            if success and 'id' in order_response:
                self.order_id = order_response['id']
        
        # List orders
        self.run_test(
            "List Orders",
            "GET",
            f"orders/{self.unit_id}",
            200
        )
        
        # Update order status
        if self.order_id:
            self.run_test(
                "Update Order Status",
                "PUT",
                f"orders/{self.order_id}/status?status=completed",
                200
            )

    def test_pdf_generation(self):
        """Test PDF Generation"""
        print("\n📄 Testing PDF Generation...")
        
        if not self.order_id:
            self.log_test("PDF Generation - No Order", False, "No order available for PDF generation")
            return
        
        success, response = self.run_test(
            "Generate Order PDF",
            "GET",
            f"orders/{self.order_id}/pdf",
            200
        )
        
        if success and 'pdf_base64' in response:
            self.log_test("PDF Content Validation", True, "PDF base64 data received")
        else:
            self.log_test("PDF Content Validation", False, "No PDF data in response")

    def test_reports(self):
        """Test Reports functionality"""
        print("\n📈 Testing Reports...")
        
        if not self.unit_id:
            self.log_test("Reports - No Unit", False, "No unit available for testing")
            return
        
        # Dashboard stats
        self.run_test(
            "Dashboard Stats",
            "GET",
            f"reports/dashboard/{self.unit_id}",
            200
        )
        
        # Stock status report
        self.run_test(
            "Stock Status Report",
            "GET",
            f"reports/stock-status/{self.unit_id}",
            200
        )
        
        # Consumption report
        self.run_test(
            "Consumption Report",
            "GET",
            f"reports/consumption/{self.unit_id}",
            200
        )
        
        # Orders history
        self.run_test(
            "Orders History Report",
            "GET",
            f"reports/orders-history/{self.unit_id}",
            200
        )

    def test_email_functionality(self):
        """Test Email functionality (will fail gracefully without API key)"""
        print("\n📧 Testing Email Functionality...")
        
        if not self.order_id:
            self.log_test("Email - No Order", False, "No order available for email testing")
            return
        
        email_data = {
            "order_id": self.order_id,
            "recipients": ["test@example.com"]
        }
        
        # This should fail gracefully due to missing RESEND_API_KEY
        success, response = self.run_test(
            "Send Order Email (Expected to Fail)",
            "POST",
            f"orders/{self.order_id}/email",
            400,  # Expecting 400 due to missing API key
            data=email_data
        )

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting Lacucina API Testing...")
        print(f"🌐 Base URL: {self.base_url}")
        
        try:
            self.test_auth_flow()
            self.test_units_crud()
            self.test_sections_crud()
            self.test_items_crud()
            self.test_safety_stock()
            self.test_stock_entries()
            self.test_orders()
            self.test_pdf_generation()
            self.test_reports()
            self.test_email_functionality()
            
        except Exception as e:
            print(f"❌ Critical error during testing: {str(e)}")
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = LacucinaAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())