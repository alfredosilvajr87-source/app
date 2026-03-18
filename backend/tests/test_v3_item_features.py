"""
Test Suite for V3 Item Features:
- Minimum stock by day (minimum_stock_by_day)
- Item visibility per unit (visible_in_units)
- New units of measure (bottle, bucket, can, bag, pack)
- Duplicate item prevention
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials and shared state
class TestData:
    token = None
    company_id = None
    user_id = None
    section_id = None
    unit_id_1 = None
    unit_id_2 = None
    test_item_id = None


def get_auth_headers():
    """Get authentication headers"""
    if not TestData.token:
        return {}
    return {
        "Authorization": f"Bearer {TestData.token}",
        "Content-Type": "application/json"
    }


class TestUnitsOfMeasure:
    """Test new units of measure are available"""
    
    def test_units_of_measure_endpoint(self):
        """Test /api/units-of-measure returns all units including new ones"""
        response = requests.get(f"{BASE_URL}/api/units-of-measure")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        units = response.json()
        assert isinstance(units, list), "Response should be a list"
        
        # Extract values
        unit_values = [u.get("value") for u in units]
        
        # Test new units are present
        new_units = ["bottle", "bucket", "can", "bag", "pack"]
        for unit in new_units:
            assert unit in unit_values, f"New unit '{unit}' should be in units of measure"
            print(f"✓ Unit '{unit}' is available")
        
        # Test existing units still present
        existing_units = ["kg", "g", "l", "ml", "un", "cx"]
        for unit in existing_units:
            assert unit in unit_values, f"Existing unit '{unit}' should still be available"
        
        print(f"✓ All {len(units)} units of measure available")


class TestCompanySetup:
    """Setup test company and user"""
    
    def test_create_company_with_admin(self):
        """Create test company and admin user"""
        unique_id = uuid.uuid4().hex[:6]
        company_name = f"Test_V3_Company_{unique_id}"
        admin_email = f"test_admin_{unique_id}@test.com"
        admin_password = "TestPass123!"
        admin_name = "Test Admin V3"
        
        # Try to create company with admin
        response = requests.post(
            f"{BASE_URL}/api/companies/create_with_admin",
            json={
                "company_name": company_name,
                "admin_email": admin_email,
                "admin_password": admin_password,
                "admin_name": admin_name
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            TestData.token = data.get("token")
            TestData.company_id = data.get("company", {}).get("id")
            TestData.user_id = data.get("user", {}).get("id")
            print(f"✓ Created test company: {company_name}")
            assert TestData.token, "Token should be returned"
        else:
            # Check if endpoint exists - maybe use different registration flow
            print(f"Company creation returned: {response.status_code} - {response.text}")
            
            # Try using register-first endpoint
            response2 = requests.post(
                f"{BASE_URL}/api/auth/register-first",
                params={
                    "email": admin_email,
                    "password": admin_password,
                    "name": admin_name,
                    "company_name": company_name
                }
            )
            
            if response2.status_code == 200:
                data = response2.json()
                TestData.token = data.get("token")
                TestData.company_id = data.get("company", {}).get("id")
                TestData.user_id = data.get("user", {}).get("id")
                print(f"✓ Created test company via register-first: {company_name}")
            else:
                pytest.fail(f"Could not create company: {response2.status_code} - {response2.text}")
        
        assert TestData.token, "Token should be set"


class TestSectionCreation:
    """Create sections needed for item tests"""
    
    def test_create_test_section(self):
        """Create a section for testing items"""
        section_data = {
            "name": f"TEST_Section_{uuid.uuid4().hex[:6]}",
            "description": "Test section for V3 features",
            "icon": "Package"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sections",
            json=section_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        TestData.section_id = data.get("id")
        assert TestData.section_id, "Section ID should be returned"
        print(f"✓ Created test section: {data.get('name')}")


class TestUnitCreation:
    """Create units needed for item visibility tests"""
    
    def test_create_test_units(self):
        """Create units for visibility testing"""
        # Create Unit 1
        unit1_data = {
            "name": f"TEST_Unit_1_{uuid.uuid4().hex[:4]}",
            "initials": "TU1",
            "address": "Test Address 1"
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/units",
            json=unit1_data,
            headers=get_auth_headers()
        )
        assert response1.status_code == 200, f"Expected 200, got {response1.status_code}: {response1.text}"
        TestData.unit_id_1 = response1.json().get("id")
        print(f"✓ Created unit 1: {unit1_data['name']}")
        
        # Create Unit 2
        unit2_data = {
            "name": f"TEST_Unit_2_{uuid.uuid4().hex[:4]}",
            "initials": "TU2",
            "address": "Test Address 2"
        }
        
        response2 = requests.post(
            f"{BASE_URL}/api/units",
            json=unit2_data,
            headers=get_auth_headers()
        )
        assert response2.status_code == 200, f"Expected 200, got {response2.status_code}: {response2.text}"
        TestData.unit_id_2 = response2.json().get("id")
        print(f"✓ Created unit 2: {unit2_data['name']}")


class TestItemBasicCreation:
    """Test basic item creation"""
    
    def test_create_item_basic(self):
        """Create item with basic fields only"""
        item_data = {
            "name": f"TEST_Basic_Item_{uuid.uuid4().hex[:6]}",
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 10
        }
        
        response = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("name") == item_data["name"]
        assert data.get("unit_of_measure") == "kg"
        assert data.get("minimum_stock") == 10
        print(f"✓ Created basic item: {data.get('name')}")


class TestNewUnitsOfMeasureInItems:
    """Test creating items with new units of measure"""
    
    def test_create_item_with_bottle(self):
        """Create item with bottle unit"""
        self._test_item_with_unit("bottle")
    
    def test_create_item_with_bucket(self):
        """Create item with bucket unit"""
        self._test_item_with_unit("bucket")
    
    def test_create_item_with_can(self):
        """Create item with can unit"""
        self._test_item_with_unit("can")
    
    def test_create_item_with_bag(self):
        """Create item with bag unit"""
        self._test_item_with_unit("bag")
    
    def test_create_item_with_pack(self):
        """Create item with pack unit"""
        self._test_item_with_unit("pack")
    
    def _test_item_with_unit(self, unit):
        """Helper to test item creation with specified unit"""
        item_data = {
            "name": f"TEST_{unit.upper()}_Item_{uuid.uuid4().hex[:6]}",
            "section_id": TestData.section_id,
            "unit_of_measure": unit,
            "minimum_stock": 5
        }
        
        response = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("unit_of_measure") == unit, f"Item should have unit '{unit}'"
        print(f"✓ Created item with unit '{unit}': {data.get('name')}")


class TestMinimumStockByDay:
    """Test minimum stock per day of week feature"""
    
    def test_create_item_with_minimum_stock_by_day(self):
        """Create item with different minimum stock for each day"""
        item_data = {
            "name": f"TEST_DailyMinStock_{uuid.uuid4().hex[:6]}",
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 10,
            "minimum_stock_by_day": {
                "monday": 5,
                "tuesday": 7,
                "wednesday": 10,
                "thursday": 12,
                "friday": 15,
                "saturday": 20,
                "sunday": 8
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        TestData.test_item_id = data.get("id")
        
        assert data.get("minimum_stock_by_day") is not None, "minimum_stock_by_day should be saved"
        
        day_stock = data.get("minimum_stock_by_day")
        assert day_stock.get("monday") == 5
        assert day_stock.get("friday") == 15
        assert day_stock.get("saturday") == 20
        print(f"✓ Created item with minimum stock by day: {data.get('name')}")
        print(f"  Day values: {day_stock}")
    
    def test_update_item_minimum_stock_by_day(self):
        """Update item's minimum stock by day"""
        if not TestData.test_item_id:
            pytest.skip("No item created")
        
        update_data = {
            "name": f"TEST_DailyMinStock_Updated_{uuid.uuid4().hex[:4]}",
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 15,
            "minimum_stock_by_day": {
                "monday": 10,
                "tuesday": 12,
                "wednesday": 15,
                "thursday": 18,
                "friday": 25,
                "saturday": 30,
                "sunday": 12
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/items/{TestData.test_item_id}",
            json=update_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        day_stock = data.get("minimum_stock_by_day")
        assert day_stock.get("friday") == 25, "Friday minimum should be updated to 25"
        assert day_stock.get("saturday") == 30, "Saturday minimum should be updated to 30"
        print(f"✓ Updated item minimum stock by day successfully")
    
    def test_item_with_null_minimum_stock_by_day(self):
        """Test that items can have null minimum_stock_by_day"""
        item_data = {
            "name": f"TEST_NoDailyMin_{uuid.uuid4().hex[:6]}",
            "section_id": TestData.section_id,
            "unit_of_measure": "un",
            "minimum_stock": 5,
            "minimum_stock_by_day": None
        }
        
        response = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # minimum_stock_by_day should be null
        assert data.get("minimum_stock_by_day") is None, "minimum_stock_by_day should be null"
        print(f"✓ Created item with null minimum_stock_by_day")


class TestItemVisibility:
    """Test item visibility per unit feature"""
    
    def test_create_item_visible_in_specific_units(self):
        """Create item visible only in specific units"""
        if not TestData.unit_id_1:
            pytest.skip("No units created")
        
        unit_ids = [TestData.unit_id_1]
        
        item_data = {
            "name": f"TEST_VisibleInUnits_{uuid.uuid4().hex[:6]}",
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 10,
            "visible_in_units": unit_ids
        }
        
        response = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("visible_in_units") == unit_ids, "visible_in_units should match"
        print(f"✓ Created item visible in specific units: {data.get('visible_in_units')}")
    
    def test_create_item_visible_in_all_units(self):
        """Create item visible in all units (empty array)"""
        item_data = {
            "name": f"TEST_VisibleAll_{uuid.uuid4().hex[:6]}",
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 5,
            "visible_in_units": []  # Empty = visible in all
        }
        
        response = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("visible_in_units") == [], "visible_in_units should be empty"
        print(f"✓ Created item visible in all units (empty array)")
    
    def test_get_items_filtered_by_unit(self):
        """Test items filtering by unit_id query param"""
        if not TestData.unit_id_1:
            pytest.skip("No units available")
        
        # Get items filtered by unit
        response = requests.get(
            f"{BASE_URL}/api/items?unit_id={TestData.unit_id_1}",
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        items = response.json()
        # Items with empty visible_in_units should be included
        # Items with this unit_id in visible_in_units should be included
        print(f"✓ Items filtered by unit: {len(items)} items returned for unit {TestData.unit_id_1}")


class TestDuplicateItemPrevention:
    """Test that duplicate items are prevented"""
    
    def test_duplicate_item_same_name_section_unit(self):
        """Test creating item with same name, section, and unit fails"""
        unique_name = f"TEST_Duplicate_{uuid.uuid4().hex[:6]}"
        
        # Create first item
        item_data = {
            "name": unique_name,
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 10
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert response1.status_code == 200, f"First item should be created: {response1.text}"
        print(f"✓ Created first item: {unique_name}")
        
        # Try to create duplicate
        response2 = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert response2.status_code == 400, f"Duplicate should return 400, got {response2.status_code}"
        
        error_detail = response2.json().get("detail", "")
        assert "already exists" in error_detail.lower(), f"Error should mention duplicate: {error_detail}"
        print(f"✓ Duplicate item correctly rejected with 400")
    
    def test_same_name_different_section_allowed(self):
        """Test that same name in different section is allowed"""
        # Need to create second section
        section2_data = {
            "name": f"TEST_Second_Section_{uuid.uuid4().hex[:4]}",
            "description": "For duplicate testing",
            "icon": "Box"
        }
        section2_response = requests.post(
            f"{BASE_URL}/api/sections",
            json=section2_data,
            headers=get_auth_headers()
        )
        
        if section2_response.status_code != 200:
            pytest.skip("Could not create second section")
        
        section2_id = section2_response.json().get("id")
        unique_name = f"TEST_SameName_{uuid.uuid4().hex[:6]}"
        
        # Create in section 1
        item_data1 = {
            "name": unique_name,
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 10
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data1,
            headers=get_auth_headers()
        )
        assert response1.status_code == 200
        
        # Create in section 2 (different section)
        item_data2 = {
            "name": unique_name,
            "section_id": section2_id,
            "unit_of_measure": "kg",
            "minimum_stock": 10
        }
        
        response2 = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data2,
            headers=get_auth_headers()
        )
        assert response2.status_code == 200, f"Same name in different section should be allowed: {response2.text}"
        print(f"✓ Same name in different section is allowed")
    
    def test_same_name_different_unit_of_measure_allowed(self):
        """Test that same name with different unit of measure is allowed"""
        unique_name = f"TEST_SameNameDiffUnit_{uuid.uuid4().hex[:6]}"
        
        # Create with kg
        item_data1 = {
            "name": unique_name,
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 10
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data1,
            headers=get_auth_headers()
        )
        assert response1.status_code == 200
        
        # Create with different unit (un)
        item_data2 = {
            "name": unique_name,
            "section_id": TestData.section_id,
            "unit_of_measure": "un",  # Different unit
            "minimum_stock": 10
        }
        
        response2 = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data2,
            headers=get_auth_headers()
        )
        assert response2.status_code == 200, f"Same name with different unit should be allowed: {response2.text}"
        print(f"✓ Same name with different unit of measure is allowed")


class TestItemUpdate:
    """Test item update with new fields"""
    
    def test_update_item_with_all_new_fields(self):
        """Update item with all V3 fields"""
        unit_ids = [TestData.unit_id_1] if TestData.unit_id_1 else []
        
        # Create item first
        item_data = {
            "name": f"TEST_UpdateItem_{uuid.uuid4().hex[:6]}",
            "section_id": TestData.section_id,
            "unit_of_measure": "kg",
            "minimum_stock": 10
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/items",
            json=item_data,
            headers=get_auth_headers()
        )
        assert create_response.status_code == 200
        item_id = create_response.json().get("id")
        
        # Update with all V3 fields
        update_data = {
            "name": f"TEST_UpdatedItem_{uuid.uuid4().hex[:4]}",
            "section_id": TestData.section_id,
            "unit_of_measure": "bottle",  # New unit
            "minimum_stock": 15,
            "minimum_stock_by_day": {
                "monday": 10,
                "tuesday": 10,
                "wednesday": 15,
                "thursday": 15,
                "friday": 20,
                "saturday": 25,
                "sunday": 10
            },
            "visible_in_units": unit_ids,
            "item_type": "restaurant",
            "show_in_reports": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/items/{item_id}",
            json=update_data,
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("unit_of_measure") == "bottle"
        assert data.get("minimum_stock") == 15
        assert data.get("minimum_stock_by_day", {}).get("saturday") == 25
        assert data.get("visible_in_units") == unit_ids
        print(f"✓ Updated item with all V3 fields successfully")


class TestExistingItemsIntegrity:
    """Test that existing items still work correctly"""
    
    def test_get_all_items(self):
        """Verify all items can be retrieved"""
        response = requests.get(
            f"{BASE_URL}/api/items",
            headers=get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        items = response.json()
        print(f"✓ Retrieved {len(items)} items successfully")
        
        # Check that items have expected fields
        if items:
            sample_item = items[0]
            required_fields = ["id", "name", "section_id", "unit_of_measure", "minimum_stock"]
            for field in required_fields:
                assert field in sample_item, f"Item should have field '{field}'"
            print(f"✓ Items have all required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
