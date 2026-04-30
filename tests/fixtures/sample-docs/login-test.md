# Test Case: User Login

## TC-001: Successful Login
**Preconditions**: User is on the login page
**Steps**:
1. Enter "admin" in the username field
2. Enter "password" in the password field
3. Click the "Login" button
**Expected Result**: User sees "Logged in as admin" message and search section is visible

## TC-002: Failed Login
**Preconditions**: User is on the login page
**Steps**:
1. Enter "admin" in the username field
2. Enter "wrongpassword" in the password field
3. Click the "Login" button
**Expected Result**: User sees "Login failed" message and search section remains hidden

## TC-003: Search Functionality
**Preconditions**: User is logged in
**Steps**:
1. Enter "test query" in the search field
2. Click the "Search" button
**Expected Result**: Results area shows "You searched for: test query"

## TC-004: Empty Search
**Preconditions**: User is logged in
**Steps**:
1. Leave the search field empty
2. Click the "Search" button
**Expected Result**: Results area shows "You searched for:"
