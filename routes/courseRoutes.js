const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Course Routes
 * 
 * Public routes for course catalog browsing
 * Authenticated routes for course purchases and enrollment management
 */

/**
 * Public Course Catalog Routes
 */

// Get all departments
router.get('/departments', courseController.getDepartments);

// Get courses by department
router.get('/departments/:id/courses', courseController.getCoursesByDepartment);

// Search courses (must be before /:id route)
router.get('/search', courseController.searchCourses);

// Get course details
router.get('/:id', courseController.getCourseById);

/**
 * Authenticated Course Routes
 * All routes below require authentication
 */
router.use(authMiddleware);

// Purchase course (requires student details)
router.post('/:id/purchase', courseController.purchaseCourse);

// Get user's course enrollments
router.get('/my-enrollments', courseController.getMyEnrollments);

module.exports = router;