const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');

// @desc    Create assignment (teacher only)
// @route   POST /api/assignments
// @access  Private/Teacher
const createAssignment = async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    let fileUrl = null;
    let originalFileName = null;

    if (req.file) {
      fileUrl = req.file.path;
      originalFileName = req.file.originalname;
    }

    const assignment = await Assignment.create({
      title,
      description,
      dueDate,
      fileUrl,
      originalFileName,
      teacher: req.user._id
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all assignments
// @route   GET /api/assignments
// @access  Private
const getAssignments = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'teacher') {
      // Teachers see their own assignments; can filter by status
      query.teacher = req.user._id;
      if (req.query.status) {
        query.status = req.query.status;
      }
    } else {
      // Students only see published assignments
      query.status = 'published';
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Assignment.countDocuments(query);
    const assignments = await Assignment.find(query)
      .populate('teacher', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: assignments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: assignments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Private
const getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate('teacher', 'name email');

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Students can only view published assignments
    if (req.user.role === 'student' && assignment.status !== 'published') {
      return res.status(403).json({ success: false, message: 'Assignment not available' });
    }

    // Teachers can only view their own assignments
    if (req.user.role === 'teacher' && assignment.teacher._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this assignment' });
    }

    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update assignment (teacher only, draft only for edits)
// @route   PUT /api/assignments/:id
// @access  Private/Teacher
const updateAssignment = async (req, res) => {
  try {
    let assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (assignment.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this assignment' });
    }

    const { title, description, dueDate, status } = req.body;

    // Validate state transitions: draft→published→completed only
    if (status) {
      const validTransitions = {
        draft: ['published'],
        published: ['completed'],
        completed: []
      };

      if (!validTransitions[assignment.status].includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition from '${assignment.status}' to '${status}'`
        });
      }
    }

    // Only allow editing title/desc/dueDate when draft
    if (assignment.status !== 'draft' && (title || description || dueDate)) {
      // Allow status update but block field edits
      if (title || description || dueDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot edit fields of a published or completed assignment'
        });
      }
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (assignment.status === 'draft') {
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (dueDate) updateData.dueDate = dueDate;
      if (req.file) {
        updateData.fileUrl = req.file.path;
        updateData.originalFileName = req.file.originalname;
      }
    }

    assignment = await Assignment.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete assignment (teacher only, draft only)
// @route   DELETE /api/assignments/:id
// @access  Private/Teacher
const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (assignment.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this assignment' });
    }

    if (assignment.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft assignments can be deleted' });
    }

    await assignment.deleteOne();
    res.status(200).json({ success: true, message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all submissions for an assignment (teacher only)
// @route   GET /api/assignments/:id/submissions
// @access  Private/Teacher
const getAssignmentSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (assignment.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const submissions = await Submission.find({ assignment: req.params.id })
      .populate('student', 'name email')
      .sort({ submittedAt: -1 });

    res.status(200).json({ success: true, count: submissions.length, data: submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get teacher analytics
// @route   GET /api/assignments/analytics
// @access  Private/Teacher
const getAnalytics = async (req, res) => {
  try {
    const teacherId = req.user._id;

    const [draft, published, completed, totalSubmissions] = await Promise.all([
      Assignment.countDocuments({ teacher: teacherId, status: 'draft' }),
      Assignment.countDocuments({ teacher: teacherId, status: 'published' }),
      Assignment.countDocuments({ teacher: teacherId, status: 'completed' }),
      Submission.countDocuments({
        assignment: { $in: await Assignment.find({ teacher: teacherId }).distinct('_id') }
      })
    ]);

    res.status(200).json({
      success: true,
      data: { draft, published, completed, totalSubmissions, total: draft + published + completed }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createAssignment,
  getAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentSubmissions,
  getAnalytics
};
