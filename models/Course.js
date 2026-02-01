const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  departmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'department_id',
    validate: {
      notEmpty: true
    }
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  link: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      isUrl: true
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  curriculum: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  duration: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [0, 100]
    }
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'image_url',
    validate: {
      isUrl: {
        msg: 'Image URL must be a valid URL'
      }
    }
  },
  priceUsd: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 35.00,
    field: 'price_usd',
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  priceNgn: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 50000.00,
    field: 'price_ngn',
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
}, {
  tableName: 'courses',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: (course) => {
      // Ensure fixed pricing
      course.priceUsd = 35.00;
      course.priceNgn = 50000.00;
    },
    beforeUpdate: (course) => {
      // Prevent price changes
      if (course.changed('priceUsd') || course.changed('priceNgn')) {
        course.priceUsd = 35.00;
        course.priceNgn = 50000.00;
      }
    }
  },
  scopes: {
    active: {
      where: { isActive: true }
    },
    withDepartment: {
      include: [{
        model: sequelize.models.Department,
        as: 'department'
      }]
    }
  }
});

// Instance methods
Course.prototype.getPrice = function(currency = 'NGN') {
  return currency.toUpperCase() === 'USD' ? this.priceUsd : this.priceNgn;
};

Course.prototype.getEnrollmentCount = async function() {
  const CourseEnrollment = require('./CourseEnrollment');
  return await CourseEnrollment.count({
    where: { courseId: this.id }
  });
};

Course.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Convert prices to numbers for JSON response
  if (values.priceUsd) values.priceUsd = parseFloat(values.priceUsd);
  if (values.priceNgn) values.priceNgn = parseFloat(values.priceNgn);
  
  return values;
};

// Class methods
Course.findByDepartment = function(departmentId, options = {}) {
  return this.findAll({
    where: { 
      departmentId, 
      isActive: true 
    },
    order: [['name', 'ASC']],
    ...options
  });
};

Course.findActiveWithDepartment = function(options = {}) {
  return this.scope(['active', 'withDepartment']).findAll({
    order: [['name', 'ASC']],
    ...options
  });
};

Course.searchCourses = function(query, departmentId = null, options = {}) {
  const whereClause = {
    isActive: true,
    [sequelize.Op.or]: [
      { name: { [sequelize.Op.iLike]: `%${query}%` } },
      { content: { [sequelize.Op.iLike]: `%${query}%` } },
      { curriculum: { [sequelize.Op.iLike]: `%${query}%` } }
    ]
  };

  if (departmentId) {
    whereClause.departmentId = departmentId;
  }

  return this.findAll({
    where: whereClause,
    include: [{
      model: sequelize.models.Department,
      as: 'department'
    }],
    order: [['name', 'ASC']],
    ...options
  });
};

module.exports = Course;