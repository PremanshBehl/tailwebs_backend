const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');

// @desc    Submit answer to an assignment (student only)
// @route   POST /api/submissions
// @access  Private/Student
const createSubmission = async (req, res) => {
  try {
    const { assignmentId, answer } = req.body;

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (assignment.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Assignment is not open for submission' });
    }

    // Bonus: block submission after due date
    if (new Date() > new Date(assignment.dueDate)) {
      return res.status(400).json({ success: false, message: 'Submission deadline has passed' });
    }

    // Check for existing submission
    const existingSubmission = await Submission.findOne({
      assignment: assignmentId,
      student: req.user._id
    });

    if (existingSubmission) {
      return res.status(400).json({ success: false, message: 'You have already submitted an answer for this assignment' });
    }

    const submission = await Submission.create({
      assignment: assignmentId,
      student: req.user._id,
      answer
    });

    // Increment submission count on assignment
    await Assignment.findByIdAndUpdate(assignmentId, { $inc: { submissionCount: 1 } });

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already submitted an answer for this assignment' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get student's own submissions
// @route   GET /api/submissions/my
// @access  Private/Student
const getMySubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user._id })
      .populate('assignment', 'title description dueDate status')
      .sort({ submittedAt: -1 });

    res.status(200).json({ success: true, count: submissions.length, data: submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark submission as reviewed (teacher only)
// @route   PATCH /api/submissions/:id/review
// @access  Private/Teacher
const markReviewed = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id).populate('assignment');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    if (submission.assignment.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    submission.reviewed = true;
    await submission.save();

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createSubmission, getMySubmissions, markReviewed };
