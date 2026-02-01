const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CourseEnrollment = sequelize.define('CourseEnrollment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    validate: {
      notEmpty: true,
      isInt: true
    }
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'course_id',
    validate: {
      notEmpty: true
    }
  },
  purchaseId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'purchase_id',
    validate: {
      notEmpty: true
    }
  },
  studentName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'student_name',
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  studentEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'student_email',
    validate: {
      notEmpty: true,
      isEmail: true,
      len: [1, 255]
    }
  },
  studentPhone: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'student_phone',
    validate: {
      notEmpty: true,
      len: [1, 50]
    }
  },
  credentialsSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'credentials_sent'
  },
  sentBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'sent_by',
    validate: {
      isInt: true
    }
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at'
  },
}, {
  tableName: 'course_enrollments',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeUpdate: (enrollment) => {
      // Auto-set sentAt timestamp when credentialsSent is toggled to true
      if (enrollment.changed('credentialsSent') && enrollment.credentialsSent === true) {
        enrollment.sentAt = new Date();
      }
      // Clear sentAt if credentialsSent is toggled to false
      if (enrollment.changed('credentialsSent') && enrollment.credentialsSent === false) {
        enrollment.sentAt = null;
        enrollment.sentBy = null;
      }
    }
  },
  scopes: {
    pending: {
      where: { credentialsSent: false }
    },
    completed: {
      where: { credentialsSent: true }
    },
    withDetails: {
      include: [
        {
          model: sequelize.models.Course,
          as: 'course',
          include: [{
            model: sequelize.models.Department,
            as: 'department'
          }]
        },
        {
          model: sequelize.models.User,
          as: 'user',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: sequelize.models.Purchase,
          as: 'purchase',
          attributes: ['id', 'amount', 'currency', 'paymentGateway', 'paymentReference', 'createdAt']
        }
      ]
    }
  }
});

// Instance methods
CourseEnrollment.prototype.markCredentialsSent = async function(adminId) {
  this.credentialsSent = true;
  this.sentBy = adminId;
  this.sentAt = new Date();
  return await this.save();
};

CourseEnrollment.prototype.markCredentialsNotSent = async function() {
  this.credentialsSent = false;
  this.sentBy = null;
  this.sentAt = null;
  return await this.save();
};

CourseEnrollment.prototype.getStudentDetails = function() {
  return {
    name: this.studentName,
    email: this.studentEmail,
    phone: this.studentPhone
  };
};

CourseEnrollment.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Add computed fields
  values.studentDetails = this.getStudentDetails();
  
  return values;
};

// Class methods
CourseEnrollment.findPendingForAdmin = function(options = {}) {
  return this.scope(['pending', 'withDetails']).findAll({
    order: [['createdAt', 'DESC']],
    ...options
  });
};

CourseEnrollment.findCompletedForAdmin = function(options = {}) {
  return this.scope(['completed', 'withDetails']).findAll({
    order: [['sentAt', 'DESC']],
    ...options
  });
};

CourseEnrollment.findByUser = function(userId, options = {}) {
  return this.scope('withDetails').findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

CourseEnrollment.findByCourse = function(courseId, options = {}) {
  return this.scope('withDetails').findAll({
    where: { courseId },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

CourseEnrollment.getStatistics = async function() {
  const [totalEnrollments, pendingEnrollments, completedEnrollments] = await Promise.all([
    this.count(),
    this.count({ where: { credentialsSent: false } }),
    this.count({ where: { credentialsSent: true } })
  ]);

  return {
    total: totalEnrollments,
    pending: pendingEnrollments,
    completed: completedEnrollments,
    completionRate: totalEnrollments > 0 ? (completedEnrollments / totalEnrollments * 100).toFixed(2) : 0
  };
};

module.exports = CourseEnrollment;