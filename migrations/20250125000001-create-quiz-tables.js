'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create quiz_profiles table
    await queryInterface.createTable('quiz_profiles', {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        allowNull: false
      },
      nickname: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      avatar_ref: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'lib:avatar_1'
      },
      zeta_balance: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100
      },
      wins: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      losses: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      last_daily_refill: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      }
    });

    // Create quiz_challenges table
    await queryInterface.createTable('quiz_challenges', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      challenger_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      categories: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false
      },
      wager: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      wager_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected', 'timed_out', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create quiz_matches table
    await queryInterface.createTable('quiz_matches', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      player_a_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      player_b_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      player_a_score: {
        type: Sequelize.SMALLINT,
        allowNull: false,
        defaultValue: 0
      },
      player_b_score: {
        type: Sequelize.SMALLINT,
        allowNull: false,
        defaultValue: 0
      },
      winner_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      wager: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      match_type: {
        type: Sequelize.ENUM('pvp', 'ai_practice'),
        allowNull: false,
        defaultValue: 'pvp'
      },
      status: {
        type: Sequelize.ENUM('in_progress', 'completed', 'aborted'),
        allowNull: false,
        defaultValue: 'completed'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes
    await queryInterface.addIndex('quiz_profiles', ['zeta_balance']);
    await queryInterface.addIndex('quiz_challenges', ['challenger_id']);
    await queryInterface.addIndex('quiz_challenges', ['target_id']);
    await queryInterface.addIndex('quiz_challenges', ['status']);
    await queryInterface.addIndex('quiz_matches', ['player_a_id']);
    await queryInterface.addIndex('quiz_matches', ['player_b_id']);
    await queryInterface.addIndex('quiz_matches', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('quiz_matches');
    await queryInterface.dropTable('quiz_challenges');
    await queryInterface.dropTable('quiz_profiles');
  }
};