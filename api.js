const express = require('express');
const axios = require('axios');
const _ = require('lodash');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());

const API_URL = 'https://intent-kit-16.hasura.app/api/rest/blogs';
const ADMIN_SECRET = '32qR4KmXOIpsGPQKMqEJHGJS27G5s7HdSKO3gdtQd2kv5e852SiYwWNfxkZOBuQ6';
const cacheTimeout = 3600000;

let lastCacheTime = null;
let cachedBlogStats = null;

const fetchBlogData = async () => {
    try {
        const response = await axios.get(API_URL, {
            headers: {
                'x-hasura-admin-secret': ADMIN_SECRET,
            },
        });

        const blogData = response.data.blogs;
        if (!Array.isArray(blogData)) {
            throw new Error('Received data is not an array.');
        }

        return blogData;
    } catch (error) {
        console.error('Error fetching blog data:', error.message);
        throw new Error('An error occurred while fetching blog data.');
    }
};

const calculateBlogStats = (blogData) => {
    const totalBlogs = blogData.length;
    const longestBlog = _.maxBy(blogData, (blog) => blog.title.length);
    const blogsWithPrivacy = blogData.filter((blog) =>
        blog.title.toLowerCase().includes('privacy')
    );
    const uniqueBlogTitles = _.uniqBy(blogData, 'title').map((blog) => blog.title);

    return {
        totalBlogs,
        longestBlog: longestBlog.title,
        blogsWithPrivacy: blogsWithPrivacy.length,
        uniqueBlogTitles,
    };
};

const refreshCacheIfNeeded = async () => {
    const currentTime = new Date().getTime();
    if (!lastCacheTime || currentTime - lastCacheTime >= cacheTimeout) {
        console.log('Refreshing cache...');
        const blogData = await fetchBlogData();
        cachedBlogStats = calculateBlogStats(blogData);
        lastCacheTime = currentTime;
    }
};

app.get('/api/blog-stats', async (req, res) => {
    try {
        await refreshCacheIfNeeded();
        res.json(cachedBlogStats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/blog-search', async (req, res) => {
    const query = req.query.query.toLowerCase();

    if (!query) {
        return res.status(400).json({ error: 'Query parameter is missing.' });
    }

    try {
        const blogData = await fetchBlogData();
        const filteredBlogData = blogData.filter((blog) =>
            blog.title.toLowerCase().includes(query)
        );
        res.json(filteredBlogData);
    } catch (error) {
        console.error('Error searching blogs:', error.message);
        res.status(500).json({ error: 'An error occurred while searching blogs.' });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
