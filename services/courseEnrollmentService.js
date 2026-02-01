const { Op } = require('sequelize');
const sequelize = require('../config/db');

// Import models with associations
require('../models/courseIndex');
const CourseEnrollment = require('../models/CourseEnrollment');
const Course = require('../models/Course');
const Department = require('../models/Department');
const Purchase = require('../models/Purchase');
const User = require('../models/User');

/**
 * Course Enrollment Service
 * 
 * Handles all course enrollment-related business logic:
 * - Enrollment creation with student details
 * - Admin dashboard enrollment management
 * - Credentials sent toggle functionality
 * - Student data management and validation
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 9.3
 */

class CourseEnrollmentService {
  constructor() {
    // Configuration
    this.config = {
      // Default pagination
      pagination: {
        defaultLimit: 20,
        maxLimit: 100
      },
      
      // Validation rules
      validation: {
        studentName: {
          minLength: 1,
          maxLength: 255
        },
        studentEmail: {
          maxLength: 255
        },
        studentPhone: {
          minLength: 1,
          maxLength: 50
        }
      }
    };
  }

  /**
   * Create enrollment after successful payment
   * @param {Object} enrollmentData - Enrollment data
   * @returns {Promise<Object>} Created enrollment
   */
  async createEnrollment(enrollmentData) {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        userId,
        courseId,
        purchaseId,
        studentName,
        studentEmail,
        studentPhone
      } = enrollmentData;

      console.log(`[Enrollment Service] Creating enrollment for user ${userId}, course ${courseId}`);

      // Validate required fields
      const validation = this.validateStudentDetails({
        studentName,
        studentEmail,
        studentPhone
      });

      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if enrollment already exists
      const existingEnrollment = await CourseEnrollment.findOne({
        where: { userId, courseId },
        transaction
      });

      if (existingEnrollment) {
        await transaction.rollback();
        throw new Error('User is already enrolled in this course');
      }

      // Verify course exists and is active
      const course = await Course.findOne({
        where: { id: courseId, isActive: true },
        transaction
      });

      if (!course) {
        await transaction.rollback();
        throw new Error('Course not found or inactive');
      }

      // Verify purchase exists and is completed
      const purchase = await Purchase.findOne({
        where: { 
          id: purchaseId,
          userId,
          contentType: 'course',
          contentId: courseId,
          paymentStatus: 'completed'
        },
        transaction
      });

      if (!purchase) {
        await transaction.rollback();
        throw new Error('Valid purchase not found for this course');
      }

      // Create enrollment
      const enrollment = await CourseEnrollment.create({
        userId,
        courseId,
        purchaseId,
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim().toLowerCase(),
        studentPhone: studentPhone.trim(),
        credentialsSent: false
      }, { transaction });

      await transaction.commit();

      console.log(`[Enrollment Service] Enrollment created with ID: ${enrollment.id}`);

      // Return enrollment with related data
      return await this.getEnrollmentDetails(enrollment.id);

    } catch (error) {
      await transaction.rollback();
      console.error('[Enrollment Service] Create enrollment error:', error);
      throw error;
    }
  }

  /**
   * Get enrollments for admin dashboard
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated enrollments
   */
  async getEnrollmentsForAdmin(options = {}) {
    try {
      const {
        status = 'all', // 'pending', 'completed', 'all'
        limit = this.config.pagination.defaultLimit,
        offset = 0,
        search = null,
        departmentId = null,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = options;

      console.log(`[Enrollment Service] Getting enrollments for admin - status: ${status}`);

      // Build where clause
      const whereClause = {};

      if (status === 'pending') {
        whereClause.credentialsSent = false;
      } else if (status === 'completed') {
        whereClause.credentialsSent = true;
      }

      // Build include clause for search and filtering
      const includeClause = [
        {
          model: Course,
          as: 'course',
          include: [{
            model: Department,
            as: 'department',
            attributes: ['id', 'name', 'slug']
          }],
          where: departmentId ? { departmentId } : {}
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: Purchase,
          as: 'purchase',
          attributes: ['id', 'amount', 'currency', 'paymentGateway', 'paymentReference', 'createdAt']
        }
      ];

      // Add admin user if credentials sent
      if (status === 'completed' || status === 'all') {
        includeClause.push({
          model: User,
          as: 'adminUser',
          attributes: ['id', 'firstname', 'lastname', 'email'],
          required: false
        });
      }

      // Add search functionality
      if (search) {
        whereClause[Op.or] = [
          { studentName: { [Op.iLike]: `%${search}%` } },
          { studentEmail: { [Op.iLike]: `%${search}%` } },
          { studentPhone: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Validate sort parameters
      const validSortFields = ['createdAt', 'studentName', 'studentEmail', 'sentAt'];
      const validSortOrders = ['ASC', 'DESC'];
      
      const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Get total count
      const totalCount = await CourseEnrollment.count({
        where: whereClause,
        include: includeClause.filter(inc => inc.model === Course) // Only include course for counting
      });

      // Get enrollments
      const enrollments = await CourseEnrollment.findAll({
        where: whereClause,
        include: includeClause,
        order: [[safeSortBy, safeSortOrder]],
        limit: Math.min(parseInt(limit), this.config.pagination.maxLimit),
        offset: parseInt(offset)
      });

      return {
        success: true,
        enrollments: enrollments.map(enrollment => enrollment.toJSON()),
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / parseInt(limit)),
          currentPage: Math.floor(parseInt(offset) / parseInt(limit)) + 1
        },
        filters: {
          status,
          search,
          departmentId,
          sortBy: safeSortBy,
          sortOrder: safeSortOrder
        }
      };
    } catch (error) {
      console.error('[Enrollment Service] Get enrollments for admin error:', error);
      throw error;
    }
  }

  /**
   * Get enrollment details by ID
   * @param {string} enrollmentId - Enrollment ID
   * @returns {Promise<Object|null>} Enrollment details
   */
  async getEnrollmentDetails(enrollmentId) {
    try {
      console.log(`[Enrollment Service] Getting enrollment details: ${enrollmentId}`);

      const enrollment = await CourseEnrollment.findByPk(enrollmentId, {
        include: [
          {
            model: Course,
            as: 'course',
            include: [{
              model: Department,
              as: 'department'
            }]
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstname', 'lastname', 'email']
          },
          {
            model: Purchase,
            as: 'purchase'
          },
          {
            model: User,
            as: 'adminUser',
            attributes: ['id', 'firstname', 'lastname', 'email'],
            required: false
          }
        ]
      });

      if (!enrollment) {
        return null;
      }

      return enrollment.toJSON();
    } catch (error) {
      console.error('[Enrollment Service] Get enrollment details error:', error);
      throw error;
    }
  }

  /**
   * Toggle credentials sent status
   * @param {string} enrollmentId - Enrollment ID
   * @param {number} adminId - Admin user ID
   * @param {boolean} credentialsSent - New credentials sent status
   * @returns {Promise<Object>} Updated enrollment
   */
  async toggleCredentialsSent(enrollmentId, adminId, credentialsSent = true) {
    const transaction = await sequelize.transaction();
    
    try {
      console.log(`[Enrollment Service] Toggling credentials sent for enrollment ${enrollmentId} by admin ${adminId}`);

      // Find enrollment
      const enrollment = await CourseEnrollment.findByPk(enrollmentId, { transaction });

      if (!enrollment) {
        await transaction.rollback();
        throw new Error('Enrollment not found');
      }

      // Verify admin user exists
      const adminUser = await User.findByPk(adminId, { transaction });
      if (!adminUser) {
        await transaction.rollback();
        throw new Error('Admin user not found');
      }

      // Update enrollment
      if (credentialsSent) {
        await enrollment.markCredentialsSent(adminId);
      } else {
        await enrollment.markCredentialsNotSent();
      }

      await transaction.commit();

      console.log(`[Enrollment Service] Credentials sent status updated to: ${credentialsSent}`);

      // Return updated enrollment with details
      return await this.getEnrollmentDetails(enrollmentId);

    } catch (error) {
      await transaction.rollback();
      console.error('[Enrollment Service] Toggle credentials sent error:', error);
      throw error;
    }
  }

  /**
   * Get enrollments by user
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User's enrollments
   */
  async getEnrollmentsByUser(userId, options = {}) {
    try {
      const {
        limit = this.config.pagination.defaultLimit,
        offset = 0,
        includeInactive = false
      } = options;

      console.log(`[Enrollment Service] Getting enrollments for user: ${userId}`);

      const includeClause = [
        {
          model: Course,
          as: 'course',
          where: includeInactive ? {} : { isActive: true },
          include: [{
            model: Department,
            as: 'department',
            attributes: ['id', 'name', 'slug']
          }]
        },
        {
          model: Purchase,
          as: 'purchase',
          attributes: ['id', 'amount', 'currency', 'paymentGateway', 'createdAt']
        }
      ];

      // Get total count
      const totalCount = await CourseEnrollment.count({
        where: { userId },
        include: includeClause.filter(inc => inc.model === Course)
      });

      // Get enrollments
      const enrollments = await CourseEnrollment.findAll({
        where: { userId },
        include: includeClause,
        order: [['createdAt', 'DESC']],
        limit: Math.min(parseInt(limit), this.config.pagination.maxLimit),
        offset: parseInt(offset)
      });

      return {
        success: true,
        enrollments: enrollments.map(enrollment => enrollment.toJSON()),
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / parseInt(limit)),
          currentPage: Math.floor(parseInt(offset) / parseInt(limit)) + 1
        }
      };
    } catch (error) {
      console.error('[Enrollment Service] Get enrollments by user error:', error);
      throw error;
    }
  }

  /**
   * Get enrollment statistics
   * @returns {Promise<Object>} Enrollment statistics
   */
  async getEnrollmentStatistics() {
    try {
      console.log('[Enrollment Service] Getting enrollment statistics');

      const [
        totalEnrollments,
        pendingEnrollments,
        completedEnrollments,
        enrollmentsByDepartment
      ] = await Promise.all([
        CourseEnrollment.count(),
        CourseEnrollment.count({ where: { credentialsSent: false } }),
        CourseEnrollment.count({ where: { credentialsSent: true } }),
        CourseEnrollment.findAll({
          attributes: [
            [sequelize.fn('COUNT', sequelize.col('CourseEnrollment.id')), 'count']
          ],
          include: [{
            model: Course,
            as: 'course',
            attributes: [],
            include: [{
              model: Department,
              as: 'department',
              attributes: ['id', 'name']
            }]
          }],
          group: ['course.department.id', 'course.department.name'],
          order: [[sequelize.literal('count'), 'DESC']]
        })
      ]);

      const completionRate = totalEnrollments > 0 
        ? ((completedEnrollments / totalEnrollments) * 100).toFixed(2)
        : 0;

      return {
        total: totalEnrollments,
        pending: pendingEnrollments,
        completed: completedEnrollments,
        completionRate: parseFloat(completionRate),
        byDepartment: enrollmentsByDepartment.map(item => ({
          department: item.course.department,
          count: parseInt(item.get('count'))
        }))
      };
    } catch (error) {
      console.error('[Enrollment Service] Get statistics error:', error);
      throw error;
    }
  }

  /**
   * Validate student details
   * @param {Object} studentDetails - Student details to validate
   * @returns {Object} Validation result
   */
  validateStudentDetails(studentDetails) {
    const { studentName, studentEmail, studentPhone } = studentDetails;
    const errors = [];

    // Validate student name
    if (!studentName || studentName.trim().length === 0) {
      errors.push('Student name is required');
    } else if (studentName.trim().length > this.config.validation.studentName.maxLength) {
      errors.push(`Student name must be less than ${this.config.validation.studentName.maxLength} characters`);
    }

    // Validate student email
    if (!studentEmail || studentEmail.trim().length === 0) {
      errors.push('Student email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(studentEmail.trim())) {
        errors.push('Student email must be a valid email address');
      } else if (studentEmail.trim().length > this.config.validation.studentEmail.maxLength) {
        errors.push(`Student email must be less than ${this.config.validation.studentEmail.maxLength} characters`);
      }
    }

    // Validate student phone
    if (!studentPhone || studentPhone.trim().length === 0) {
      errors.push('Student phone is required');
    } else if (studentPhone.trim().length > this.config.validation.studentPhone.maxLength) {
      errors.push(`Student phone must be less than ${this.config.validation.studentPhone.maxLength} characters`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if user is enrolled in course
   * @param {number} userId - User ID
   * @param {string} courseId - Course ID
   * @returns {Promise<Object|null>} Enrollment if exists
   */
  async checkUserEnrollment(userId, courseId) {
    try {
      const enrollment = await CourseEnrollment.findOne({
        where: { userId, courseId },
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'name']
          },
          {
            model: Purchase,
            as: 'purchase',
            attributes: ['id', 'paymentStatus', 'createdAt']
          }
        ]
      });

      return enrollment ? enrollment.toJSON() : null;
    } catch (error) {
      console.error('[Enrollment Service] Check user enrollment error:', error);
      throw error;
    }
  }

  /**
   * Get service configuration
   * @returns {Object} Service configuration
   */
  getConfiguration() {
    return {
      pagination: this.config.pagination,
      validation: this.config.validation
    };
  }
}

module.exports = CourseEnrollmentService;