import { shapesToPaths, preparePaths } from './svg/normalize'
import { getProperty, setProperty } from './svg/utils'
import pathParser from './path/parser'
import pathEncoder from './path/encoder'
import { euclideanDistance } from './path/interpolate'
import warpTransform from './warp/transform'
import warpInterpolate from './warp/interpolate'
import warpExtrapolate from './warp/extrapolate'

export default class Warp
{
	constructor(element, curveType='q')
	{
		this.element = element
		/** Whether to base transformations on original path's data */
		this.baseOriginal = false

		shapesToPaths(element)
		preparePaths(element, curveType)

		const pathElements = Array.from(element.querySelectorAll('path'))

		this.paths = pathElements.map(pathElement =>
		{
			const pathString = getProperty(pathElement, 'd')
			const pathData = pathParser(pathString)

			return {
				pathElement,
				pathData,
				initialData: this.baseOriginal ? pathData : undefined
			}
		})
	}

	update()
	{
		for (let { pathElement, pathData } of this.paths)
		{
			const pathString = pathEncoder(pathData)
			setProperty(pathElement, 'd', pathString)
		}
	}

	transform(transformers)
	{
		transformers = Array.isArray(transformers) ? transformers : [ transformers ]

		for (let path of this.paths)
		{
			path.pathData = warpTransform(this.baseOriginal ? path.initialData : path.pathData, transformers)
		}

		this.update()
	}

	lockOriginal()
	{
		this.baseOriginal = true
	}

	interpolate(threshold)
	{
		let didWork = false

		function deltaFunction(points)
		{
			const linearPoints = [
				points[0].slice(0, 2),
				points[points.length - 1].slice(0, 2),
			]

			const delta = euclideanDistance(linearPoints)
			didWork = didWork || (delta > threshold)

			return delta
		}

		for (let path of this.paths)
		{
			path.pathData = warpInterpolate(path.pathData, threshold, deltaFunction)

			if ( this.baseOriginal )
			{
				path.initialData = path.pathData.map(d => Object.assign({}, d))
			}
		}

		return didWork
	}

	extrapolate(threshold)
	{
		let didWork = false

		function deltaFunction(points)
		{
			const linearPoints = [
				points[0].slice(0, 2),
				points[points.length - 1].slice(0, 2),
			]

			const delta = euclideanDistance(linearPoints)
			didWork = didWork || (delta <= threshold)

			return delta
		}

		for (let path of this.paths)
		{
			path.pathData = warpExtrapolate(path.pathData, threshold, deltaFunction)

			if ( this.baseOriginal )
			{
				path.initialData = path.pathData.map(d => Object.assign({}, d))
			}
		}

		return didWork
	}

	preInterpolate(transformer, threshold)
	{
		let didWork = false

		function deltaFunction(points)
		{
			const linearPoints = [
				points[0].slice(0, 2),
				points[points.length - 1].slice(0, 2),
			]

			const delta = euclideanDistance(linearPoints)
			didWork = didWork || (delta > threshold)

			return delta
		}

		for (let path of this.paths)
		{
			const transformed = warpTransform(path.pathData, function(points)
			{
				const newPoints = transformer(points.slice(0, 2))
				newPoints.push(...points)

				return newPoints
			})

			const interpolated = warpInterpolate(transformed, threshold, deltaFunction)

			path.pathData = warpTransform(interpolated, points => points.slice(2))

			if ( this.baseOriginal )
			{
				path.initialData = path.pathData.map(d => Object.assign({}, d))
			}
		}

		return didWork
	}

	preExtrapolate(transformer, threshold)
	{
		let didWork = false

		function deltaFunction(points)
		{
			const linearPoints = [
				points[0].slice(0, 2),
				points[points.length - 1].slice(0, 2),
			]
			
			const delta = euclideanDistance(linearPoints)
			didWork = didWork || (delta <= threshold)

			return delta
		}

		for (let path of this.paths)
		{
			const transformed = warpTransform(path.pathData, function(points)
			{
				const newPoints = transformer(points.slice(0, 2))
				newPoints.push(...points)

				return newPoints
			})

			const extrapolated = warpExtrapolate(transformed, threshold, deltaFunction)

			path.pathData = warpTransform(extrapolated, points => points.slice(2))

			if ( this.baseOriginal )
			{
				path.initialData = path.pathData.map(d => Object.assign({}, d))
			}
		}

		return didWork
	}
}
