const express = require('express');
const admin = require('./firebaseAdmin');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();



// Middleware
app.use(cors());
app.use(express.json());

//MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.poe7uux.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

function isValidObjectId(id) {
  if (ObjectId.isValid(id)) {
    if (String(new ObjectId(id)) === id) {
      return true;
    }
  }
  return false;
}

function verifyJWT(req, res, next) {

  const authHeader = req.headers.authorization;
  if (!authHeader) {
      return res.status(401).send('unauthorized access');
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
      if (err) {
          return res.status(403).send({ message: 'forbidden access' })
      }
      req.decoded = decoded;
      next();
  })

}

async function run() {
  try {

  const membersCollection = client.db('NSJnU').collection('members');
  const committeeMembersCollection = client.db('NSJnU').collection('committeeMembers');
  const articlesCollection = client.db('NSJnU').collection('articles');
  const jobsCollection = client.db('NSJnU').collection('jobs');
  const internsCollection = client.db('NSJnU').collection('interns');
  const executiveMessagesCollection = client.db('NSJnU').collection('executiveMessages');
  
  app.get('/jwt', async(req, res) => {
    const email = req.query.email;
    const query = {email: email};
    const member = await membersCollection.findOne(query);
    console.log(member);
    if(member){
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
      return res.send({ accessToken: token });
    }
    res.status(403).send({ accessToken: '' })
  });

  app.get('/members/generalmembers', async (req, res) => {
    try {
      const { status, role } = req.query;
      const query = {};
  
      if (status) {
        query.status = { $in: status.split(',') };
      }
  
      if (role) {
        query.role = role;
      }
  
      const members = await membersCollection.find(query).toArray();
      res.send(members);
    } catch (error) {
      console.error('Error fetching members:', error);
      res.status(500).send('Internal server error');
    }
  });  

  app.post('/members', async(req, res) =>{
    const member = req.body;
    member.status = 'pending';
    const result = await membersCollection.insertOne(member);
    res.send(result);
  });

  app.get('/members/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const member = await membersCollection.findOne(query);
    res.send(member);
  });

  app.delete('/members/:id', async (req, res) => {
    const id = req.params.id;
    if (!isValidObjectId(id)) {
      return res.status(400).send('Invalid ID format');
    }
    
    try {
      const query = { _id: new ObjectId(id) };
      const result = await membersCollection.deleteOne(query);
      
      if (result.deletedCount === 1) {
        res.status(200).send({ message: 'Member deleted successfully' });
      } else {
        res.status(404).send({ message: 'Member not found' });
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      res.status(500).send('Internal server error');
    }
  });

  app.delete('/members/firebase/:uid', async (req, res) => {
    const uid = req.params.uid;
  
    try {
      await admin.auth().deleteUser(uid);
      res.status(200).send({ message: 'Successfully deleted user from Firebase' });
    } catch (error) {
      console.error('Error deleting Firebase user:', error);
      res.status(500).send({ error: 'Error deleting user from Firebase', details: error.message });
    }
  });

  app.get('/members/email/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email }
    const user = await membersCollection.findOne(query);
    res.send({ isUserStatus: user?.status === 'approved' });
});
  
  

  app.get('/members/admin/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email }
    const user = await membersCollection.findOne(query);
    res.send({ isAdmin: user?.role === 'admin' });
});

  app.put('/members/status/:id', async (req, res) => {
    const id = req.params.id;
    if (!isValidObjectId(id)) {
      return res.status(400).send('Invalid ID format');
    }
    const status = req.body.status;
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: { status: status }
    };
    const result = await membersCollection.updateOne(query, updateDoc);
    res.send(result);
  });

  app.put('/members/admin/:id', async (req, res) => {
    const id = req.params.id;
    if (!isValidObjectId(id)) {
      return res.status(400).send('Invalid ID format');
    }
    const filter = { _id: new ObjectId(id) }
    const options = { upsert: true };
    const updatedDoc = {
        $set: {
            role: 'admin'
        }
    }
    const result = await membersCollection.updateOne(filter, updatedDoc, options);
    res.send(result);
});

  app.put('/members/demote/:id', async (req, res) => {
      const id = req.params.id;
      if (!isValidObjectId(id)) {
        return res.status(400).send('Invalid ID format');
      }
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updatedDoc = {
        $set: {
          role: 'user'
        }
      };
      const result = await membersCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    });
  
app.get('/members/admins', async (req, res) => {
  const query = { role: 'admin', status: 'approved' };
  const admins = await membersCollection.find(query).toArray();
  res.send(admins);
});
  
  app.get('/members/moderator/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email }
    const user = await membersCollection.findOne(query);
    res.send({ isModerator: user?.role === 'moderator' });
});

  app.put('/members/moderator/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) }
    const options = { upsert: true };
    const updatedDoc = {
        $set: {
            role: 'moderator'
        }
    }
    const result = await membersCollection.updateOne(filter, updatedDoc, options);
    res.send(result);
});

  app.put('/members/moderator/demote/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      };
      const result = await membersCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    });

  app.get('/users/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email }; // Construct query to find user by email
    const user = await membersCollection.findOne(query);
    res.send(user);
  });

  app.put('/members/:id', async (req, res) => {
    // const id = req.params.id;
    // const filter = { _id: new ObjectId(id) };
    // const updatedUser = req.body;
    // console.log(updatedUser);
    try {
        const id = req.params.id;
        const updatedData = req.body;

        const query = { _id: new ObjectId(id) };
        const updateResult = await membersCollection.updateOne(query, { $set: { 
          displayName : updatedData.displayName,
          mobileNumber: updatedData.mobileNumber,
          companyName: updatedData.companyName,
          designation: updatedData.designation,
          internship1: updatedData.internship1,
          internship2: updatedData.internship2,
          presentAddressStreet: updatedData.presentAddressStreet,
          presentAddressDistrict: updatedData.presentAddressDistrict,
          permanentAddressStreet: updatedData.permanentAddressStreet,
          permanentAddressDistrict: updatedData.permanentAddressDistrict,
          batch: updatedData.batch,
          department: updatedData.department,
          bloodGroup: updatedData.bloodGroup
         } });

        if (updateResult.modifiedCount === 1) {
            const updatedMember = await membersCollection.findOne(query);
            res.send(updatedMember);
            console.log(updatedMember);
        } else {
            res.status(404).send('Member not found.');
        }
    } catch (error) {
        console.error('Error updating member details:', error);
        res.status(500).send('Internal server error');
    }
});


app.get('/executiveMessages', async (req, res) => {
  try {
    const executiveMessages = await executiveMessagesCollection.find({}).toArray();
    res.send(executiveMessages);
  } catch (error) {
    console.error('Error fetching executive messages:', error);
    res.status(500).send('Internal server error');
  }
});

app.post('/executiveMessages', async (req, res) => {
  try {
    const message = req.body;
    const result = await executiveMessagesCollection.insertOne(message);
    res.send(result);
  } catch (error) {
    console.error('Error creating executive message:', error);
    res.status(500).send('Internal server error');
  }
});

app.delete('/executiveMessages/:id', async (req, res) => {
  const id = req.params.id;
  if (!isValidObjectId(id)) {
    return res.status(400).send('Invalid ID format');
  }
  try {
    const query = { _id: new ObjectId(id) };
    const result = await executiveMessagesCollection.deleteOne(query);
    
    if (result.deletedCount === 1) {
      res.status(200).send({ message: 'Executive message deleted successfully' });
    } else {
      res.status(404).send({ message: 'Executive message not found' });
    }
  } catch (error) {
    console.error('Error deleting executive message:', error);
    res.status(500).send('Internal server error');
  }
});


  app.get('/committeeMembers', async(req, res) => {
    const query = {};
    const committeeMembers = await committeeMembersCollection.find(query).toArray();
    res.send(committeeMembers);
  });
  app.post('/committeeMembers', async(req, res) =>{
    const committeeMember = req.body;
    const result = await committeeMembersCollection.insertOne(committeeMember);
    res.send(result);
  });
  app.delete('/committeeMembers', async (req, res) => {
    try {
      const committeeMembers = await committeeMembersCollection.find({}).toArray();
  
      // Iterate over committee members, delete images from Cloudinary, then delete data from the server
      for (const member of committeeMembers) {
        // Extract public ID from Cloudinary URL to delete the image
        // const publicId = member.photoURL.split('/').pop().split('.')[0];
  
        // Delete image from Cloudinary
        // await cloudinary.uploader.destroy(publicId);
  
        // Delete data from the server
        await committeeMembersCollection.deleteOne({ _id: member._id });
      }
  
      res.status(200).json({ message: 'All committee members and their photos have been deleted successfully.' });
    } catch (error) {
      console.error('Error deleting committee members and photos:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/articles', async(req, res) => {
    const query = {};
    const articles = await articlesCollection.find(query).toArray();
    res.send(articles);
  });
  app.post('/articles', async(req, res) =>{
    const article = req.body;
    article.createdAt = new Date();
    const result = await articlesCollection.insertOne(article);
    res.send(result);
  });

  app.get('/articles/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const article = await articlesCollection.findOne(query);
    res.send(article);
  });
  app.delete('/articles/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
  
      // Delete the article from the database
      const deleteResult = await articlesCollection.deleteOne(query);
  
      if (deleteResult.deletedCount === 1) {
        res.status(200).json({ message: 'Article deleted successfully.' });
      } else {
        res.status(404).json({ message: 'Article not found.' });
      }
    } catch (error) {
      console.error('Error deleting article:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/career/jobs', async(req, res) => {
    const query = {};
    const jobs = await jobsCollection.find(query).toArray();
    res.send(jobs);
  });
  app.post('/career/jobs', async(req, res) =>{
    const job = req.body;
    job.createdAt = new Date();
    const result = await jobsCollection.insertOne(job);
    res.send(result);
  });
  app.get('/career/jobs/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const job = await jobsCollection.findOne(query);
    res.send(job);
  });

  app.get('/career/interns', async(req, res) => {
    const query = {};
    const interns = await internsCollection.find(query).toArray();
    res.send(interns);
  });
  app.post('/career/interns', async(req, res) =>{
    const intern = req.body;
    intern.createdAt = new Date();
    const result = await internsCollection.insertOne(intern);
    res.send(result);
  });
  app.get('/career/interns/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const intern = await internsCollection.findOne(query);
    res.send(intern);
  });
  

  } 
  finally {

  }
}
run().catch(console.dir);


app.get('/', async(req, res) =>{
    res.send('nsjnu server is running');
})

app.listen(port, () => console.log(`NSJnU running on ${port}`))